async function log(logChannel, ...args) {
}

function hasRole(member, roles) {
    if(typeof(roles) == "string") {
        return member.roles.cache.some(role => roles == role.id);
    }
    return member.roles.cache.some(role => roles.includes(role.id));
}

function ctxReplier(ctx, isSlash) {
    return async(msg)=>{
        if(!isSlash) {
            return await ctx.reply(msg);
        }
        if(isSlash) {
            if(ctx.replied || ctx.deferred) {
                return await ctx.followUp(msg);
            } else {
                return await ctx.reply(msg);
            }
        }
    }
}

async function getMember(guild, user) {
    if(!user) return false;
    try {
        var member = await guild.members.fetch(user);
        return member;
    } catch(err) {
        return false;
    }
    
}

module.exports = {
    log,
    hasRole,
    ctxReplier,
    getMember
}