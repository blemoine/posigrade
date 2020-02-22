module.exports = async function() {
    console.log("Stopping the postgres");
    if ((global as any).__PG_CONTAINER__) {
        await (global as any).__PG_CONTAINER__.stop();
    }
};