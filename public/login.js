if(!window.hasOwnProperty("crypto") && !window.hasOwnProperty("localStorage")) {
    alert("Your browser is waaaaay too old to be doing this.");
} else if(crypto.randomUUID) {
    var stateUuid = crypto.randomUUID();
} else {
    var array = new Uint8Array(5);
    crypto.getRandomValues(array);
    var stateUuid = Array.from(a).map((o,i)=>[0,4].includes(i)?o.toString(16):o.toString(16).slice(0,4)).join("-");
}

if(window.stateUuid) {
    callbackUrl += `&state=${stateUuid}`;
    document.getElementById("loginBtn").addEventListener("click",e=>{
        localStorage.setItem("state", stateUuid);
        location.href = callbackUrl;
    }) 
    document.getElementById("loginBtn").classList.remove("d-none");
}