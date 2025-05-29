const app = require("./app");
const config = require("../config/index");

async function startServer(){
    try{
        const PORT = config.app.port;
        const HOSTNAME = config.app.hostname;
        app.listen(PORT, HOSTNAME, () => {
        console.log(`Server is running at http://${HOSTNAME}:${PORT}/`);
        });
    }
    catch(error){
        console.log(error);
        process.exit();
    }
}

startServer();

