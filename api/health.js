module.exports=async function handler(req,res){
  const required=['AI_API_KEY','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
  const configured=Object.fromEntries(required.map(k=>[k,Boolean(process.env[k])]));
  const healthy=configured.AI_API_KEY && configured.SUPABASE_URL && configured.SUPABASE_ANON_KEY && configured.SUPABASE_SERVICE_ROLE_KEY;
  res.status(healthy?200:503).json({ok:healthy,service:'thinkforge',checks:configured,timestamp:new Date().toISOString()});
};
