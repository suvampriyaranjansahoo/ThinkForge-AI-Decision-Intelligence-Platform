import json
import os
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
import requests
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
GOLD_CSV = ROOT / "eval" / "rag_gold_v1.csv"
RAG_BENCH = ROOT / "eval" / "rag_benchmark_real_human_v1.json"
RAG_RESULTS = ROOT / "eval" / "rag_blind_candidate_v1_results.json"
SYN_SUMMARY = ROOT / "eval" / "synthetic_real_world_evaluation_v2" / "analysis_summary.json"

st.set_page_config(page_title="ThinkForge", page_icon="🧠", layout="wide")

# Optional lightweight deployment gate for private demos. This is not a replacement for
# enterprise identity management; production deployments should authenticate upstream/API-side.
def require_demo_password():
    expected = os.getenv("STREAMLIT_APP_PASSWORD", "")
    if not expected:
        return True
    if st.session_state.get("demo_authenticated"):
        return True
    st.title("ThinkForge")
    st.caption("Private demo access")
    supplied = st.text_input("Access password", type="password")
    if st.button("Sign in", type="primary"):
        if supplied == expected:
            st.session_state["demo_authenticated"] = True
            st.rerun()
        st.error("Invalid access password.")
    return False

if not require_demo_password():
    st.stop()


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def call_api(path: str, method: str = "GET", payload: dict | None = None) -> tuple[bool, Any, str]:
    base = st.session_state.get("api_url", "").strip().rstrip("/")
    if not base:
        return False, None, "API URL not configured."
    headers = {}
    token = st.session_state.get("auth_token", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        url = f"{base}/{path.lstrip('/')}"
        r = requests.request(method, url, json=payload, headers=headers, timeout=30)
        try:
            body = r.json()
        except Exception:
            body = r.text
        return r.ok, body, f"HTTP {r.status_code}"
    except requests.RequestException as exc:
        return False, None, str(exc)


with st.sidebar:
    st.title("ThinkForge")
    st.caption("Decision Intelligence")
    page = st.radio("Workspace", ["Overview", "Decision", "RAG Search", "RAG Evaluation", "Synthetic Benchmark"])
    st.divider()
    api_url = st.text_input("ThinkForge API URL", value=os.getenv("THINKFORGE_API_URL", ""))
    st.session_state["api_url"] = api_url
    st.session_state["auth_token"] = st.text_input("API session token (optional)", type="password", value="", help="For production, place authentication in the API/session layer. Do not commit or share long-lived credentials.")
    st.caption("Leave API URL empty to explore local benchmark artifacts.")

if page == "Overview":
    st.title("ThinkForge")
    st.write("Evidence-backed decision intelligence with governance, RAG, evaluation, and outcome learning.")

    cols = st.columns(4)
    gold = load_json(RAG_BENCH)
    results = load_json(RAG_RESULTS)
    syn = load_json(SYN_SUMMARY)

    cols[0].metric("RAG queries", len(gold.get("cases", [])))
    cols[1].metric("Gold judgments", 1114 if GOLD_CSV.exists() else 0)
    cols[2].metric("Blind scorable", results.get("cases", 0))
    cols[3].metric("Synthetic observations", syn.get("observations", 0))

    st.subheader("System status")
    status = pd.DataFrame([
        ["RAG gold", "Frozen" if gold.get("gold_frozen") else "Unavailable", "150 queries"],
        ["Blind benchmark", "Measured" if results.get("status") == "measured" else "Not run", f"{results.get('cases', 0)} scorable"],
        ["Synthetic benchmark", "Simulation only", f"{syn.get('observations', 0):,} observations"],
        ["API", "Configured" if api_url else "Local mode", api_url or "No remote backend"],
    ], columns=["Component", "Status", "Details"])
    st.dataframe(status, use_container_width=True, hide_index=True)

elif page == "Decision":
    st.title("Decision Workspace")
    st.caption("Create a canonical decision record. Governance actions are available after the record exists.")
    organization_id = st.text_input(
        "Organization ID",
        help="The UUID of an organization where your authenticated account has Editor access.",
    )
    title = st.text_input("Decision title")
    context = st.text_area("Decision context", height=150)
    if st.button("Create decision", type="primary"):
        if not api_url:
            st.error("Configure a ThinkForge API URL before creating a decision.")
        elif not organization_id.strip():
            st.error("Organization ID is required.")
        elif not title.strip() or not context.strip():
            st.error("Decision title and context are required.")
        else:
            graph = {
                "decision": {
                    "id": str(uuid.uuid4()),
                    "title": title.strip(),
                    "problem": context.strip(),
                    "status": "validate",
                },
                "assumptions": [], "evidence": [], "challenges": [],
                "alternatives": [], "experiments": [], "predictions": [],
                "outcomes": [], "learnings": [],
            }
            ok, body, detail = call_api(
                "api/domain",
                "POST",
                {"action": "save", "organizationId": organization_id.strip(), "graph": graph},
            )
            if ok:
                st.success("Decision created in the canonical backend.")
                st.json(body)
            else:
                st.error(f"Backend request failed: {detail}")
                if body is not None:
                    st.json(body)

elif page == "RAG Search":
    st.title("RAG Evidence Search")
    st.caption("Uses the deployed ThinkForge API when configured; otherwise this page remains informational.")
    query = st.text_input("Search evidence")
    k = st.slider("Top-k", 1, 20, 5)
    if st.button("Search", type="primary") and query.strip():
        ok, body, detail = call_api("api/rag", "POST", {"action": "search", "payload": {"query": query, "limit": k}})
        if ok:
            st.write(f"Strategy: {body.get('strategy', 'unknown')}")
            for i, hit in enumerate(body.get("hits", []), 1):
                with st.expander(f"{i}. {hit.get('docName') or hit.get('id')}"):
                    st.write(hit.get("text", ""))
                    st.json(hit.get("citation", {}))
        else:
            if not api_url:
                st.warning("Configure a ThinkForge API URL to perform live RAG search.")
            else:
                st.error(f"Search failed: {detail}")
                if body is not None:
                    st.json(body)

elif page == "RAG Evaluation":
    st.title("RAG Evaluation")
    gold = load_json(RAG_BENCH)
    results = load_json(RAG_RESULTS)
    st.subheader("Frozen benchmark")
    st.write({
        "gold_version": gold.get("version"),
        "gold_frozen": gold.get("gold_frozen"),
        "queries": len(gold.get("cases", [])),
        "scorable_queries": results.get("cases", 0),
    })
    if results:
        metrics = {
            "Recall@5": results.get("r5"),
            "Recall@10": results.get("r10"),
            "Precision@5": results.get("p5"),
            "MRR": results.get("mrr"),
            "nDCG@10": results.get("ndcg10"),
            "MAP@10": results.get("map10"),
        }
        st.dataframe(pd.DataFrame([metrics]).T.rename(columns={0: "Value"}), use_container_width=True)
        st.info("Displayed benchmark results are for the stored blind candidate run. They are not automatically equivalent to human impact validation.")
    else:
        st.warning("No stored benchmark result found.")

elif page == "Synthetic Benchmark":
    st.title("Synthetic Real-World Benchmark")
    syn = load_json(SYN_SUMMARY)
    st.warning("Simulation only — do not interpret these observations as human-subject evidence.")
    if syn:
        c = st.columns(4)
        c[0].metric("Real-world scenarios", syn.get("real_world_scenarios", 0))
        c[1].metric("Synthetic participants", syn.get("synthetic_participants", 0))
        c[2].metric("Observations", f"{syn.get('observations', 0):,}")
        c[3].metric("Paired comparisons", f"{syn.get('paired_comparisons', 0):,}")
        dq = syn.get("decision_quality", {})
        st.subheader("Decision-quality simulation")
        st.metric("Control mean", f"{dq.get('control_mean', float('nan')):.4f}")
        st.metric("ThinkForge mean", f"{dq.get('thinkforge_mean', float('nan')):.4f}")
        st.metric("Paired delta", f"{dq.get('paired_mean_delta', float('nan')):+.4f}")
        st.write("Bootstrap 95% CI:", dq.get("bootstrap_95ci"))
        st.write("Paired sign-flip p (simulation diagnostic):", dq.get("paired_sign_flip_p_approx"))
        st.json(syn.get("secondary_deltas", {}))
    else:
        st.warning("Synthetic benchmark summary not available.")
