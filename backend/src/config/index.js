require('dotenv').config()

const config = {
    app : {
        port : process.env.PORT,
        hostname: process.env.HOSTNAME,
    },

    db : {
    }

    
};
module.exports = config;