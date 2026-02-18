function log() {

}

function hasRole(member, roles) {
    if(typeof(roles) == "string") {
        return member.roles.cache.some(role => roles == role.id);
    }
    return member.roles.cache.some(role => roles.includes(role.id));
}

module.exports = {
    log,
    hasRole
}