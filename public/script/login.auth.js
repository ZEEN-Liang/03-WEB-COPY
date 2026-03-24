var _t=localStorage.getItem('token'),_u=localStorage.getItem('username'),_a=localStorage.getItem('isAdmin')==='true';
if(_t&&_u){(window.top||window).location.href=_a?'/admin.html':'/app';}
function switchTab(tab){
  document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.form-section').forEach(function(s){s.classList.remove('active');});
  document.getElementById('tab-'+tab).classList.add('active');
  document.getElementById('section-'+tab).classList.add('active');
}
function showToast(id,msg,type){var t=document.getElementById(id);t.textContent=msg;t.className='toast '+type+' show';}
function setLoading(btn,on){btn.classList.toggle('loading',on);btn.disabled=on;}
async function handleLogin(){
  var account=document.getElementById('login-account').value.trim();
  var password=document.getElementById('login-password').value;
  var btn=document.getElementById('btn-login');
  if(!account){showToast('toast-login','请输入账号','error');return;}
  if(!password){showToast('toast-login','请输入密码','error');return;}
  setLoading(btn,true);
  try{
    var res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account,password})});
    var data=await res.json();
    if(!res.ok){showToast('toast-login',data.error||'登录失败','error');}
    else{
      localStorage.setItem('token',data.token);
      localStorage.setItem('username',data.username);
      localStorage.setItem('isAdmin',data.isAdmin?'true':'false');
      (window.top||window).location.href=data.isAdmin?'/admin.html':'/app';
    }
  }catch(e){showToast('toast-login','无法连接服务器，请确认后端已启动','error');}
  finally{setLoading(btn,false);}
}
async function handleRegister(){
  var username=document.getElementById('reg-username').value.trim();
  var email=document.getElementById('reg-email').value.trim();
  var password=document.getElementById('reg-password').value;
  var confirm=document.getElementById('reg-confirm').value;
  var terms=document.getElementById('terms-check').checked;
  var btn=document.getElementById('btn-register');
  if(username.length<3){showToast('toast-register','用户名至少 3 位','error');return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showToast('toast-register','邮箱格式不正确','error');return;}
  if(password.length<8){showToast('toast-register','密码至少 8 位','error');return;}
  if(password!==confirm){showToast('toast-register','两次密码不一致','error');return;}
  if(!terms){showToast('toast-register','请同意服务条款','error');return;}
  setLoading(btn,true);
  try{
    var res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,email,password})});
    var data=await res.json();
    if(!res.ok){showToast('toast-register',data.error||'注册失败','error');}
    else{
      localStorage.setItem('token',data.token);
      localStorage.setItem('username',data.username);
      localStorage.setItem('isAdmin','false');
      (window.top||window).location.href='/app';
    }
  }catch(e){showToast('toast-register','无法连接服务器，请确认后端已启动','error');}
  finally{setLoading(btn,false);}
}
document.addEventListener('keydown',function(e){
  if(e.key!=='Enter')return;
  document.getElementById('section-login').classList.contains('active')?handleLogin():handleRegister();
});
