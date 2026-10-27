(async()=>{
    var params = new URLSearchParams(location.search);
    var code = params.get("code");
    var state = params.get("state");
    if(!code) {
        location.href = `/auth/callback?error=${encodeURI("No access code was returned.")}`;
        return;
    }
    if(!state) {
        location.href = `/auth/callback?error=${encodeURI("No state was returned.")}`;
        return;
    }
    if(localStorage.getItem("state")!=state) {
        location.href = `/auth/callback?error=${encodeURI("State is invalid. Don't try to log in across 2 separate tabs at the same time!")}`;
        return;
    }
    location.replace(`/auth/send_code?code=${code}`);
})();