module.exports = {
    async login({ homey, body }) {
        // access the post body and perform some action on it.
        return homey.app.appLogin(body);
    },
}