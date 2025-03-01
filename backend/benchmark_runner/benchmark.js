const NUM_CLIENTS = parseInt(process.env.NUM_CLIENTS);
const NUM_THREADS = parseInt(process.env.NUM_THREADS);
const DURATION = parseInt(process.env.DURATION);
const SCALE_FACTOR = parseInt(process.env.SCALE_FACTOR);

let totalTransactions = 0;
let queryCount = 0;
let updateCount = 0;
let insertCount = 0;
const latencies = [];
const statementLatencies = {
    begin: [],
    updateAccount: [],
    selectAccount: [],
    updateTeller: [],
    updateBranch: [],
    insertHistory: [],
    commit: []
};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function checkReplicaSet() {
    try {
        const status = await db.adminCommand({ replSetGetStatus: 1 });
        if (!status.ok) {
            throw new Error("Replica set not properly configured.");
        }
    } catch (error) {
        print("⚠️ Replica set error:", error.message);
        process.exit(1);
    }
}

async function runSingleTransaction() {
    const aid = getRandomInt(1, 100000 * SCALE_FACTOR);
    const bid = getRandomInt(1, SCALE_FACTOR);
    const tid = getRandomInt(1, 10 * SCALE_FACTOR);
    const delta = getRandomInt(-5000, 5000);

    const session = db.getMongo().startSession();
    if (!session) {
        print("❌ Error: MongoDB session failed to start!");
        return;
    }

    const txnStart = Date.now();
    let inTransaction = false;

    try {
        const transactionOptions = {
            readPreference: 'primary',
            readConcern: { level: 'local' },
            writeConcern: { w: 'majority' }
        };

        const beginStart = Date.now();
        session.startTransaction(transactionOptions);
        inTransaction = true;
        statementLatencies.begin.push(Date.now() - beginStart);

        const accountStart = Date.now();
        await db.accounts.updateOne({ aid: aid }, { $inc: { abalance: delta } });
        statementLatencies.updateAccount.push(Date.now() - accountStart);
        updateCount++;

        const selectStart = Date.now();
        await db.accounts.findOne({ aid: aid });
        statementLatencies.selectAccount.push(Date.now() - selectStart);
        queryCount++;

        const tellerStart = Date.now();
        await db.tellers.updateOne({ tid: tid }, { $inc: { tbalance: delta } });
        statementLatencies.updateTeller.push(Date.now() - tellerStart);
        updateCount++;

        const branchStart = Date.now();
        await db.branches.updateOne({ bid: bid }, { $inc: { bbalance: delta } });
        statementLatencies.updateBranch.push(Date.now() - branchStart);
        updateCount++;

        const historyStart = Date.now();
        await db.history.insertOne({ tid: tid, bid: bid, aid: aid, delta: delta, mtime: new Date() });
        statementLatencies.insertHistory.push(Date.now() - historyStart);
        insertCount++;

        const commitStart = Date.now();
        await session.commitTransaction();
        inTransaction = false;
        statementLatencies.commit.push(Date.now() - commitStart);

        latencies.push(Date.now() - txnStart);
        totalTransactions++;
    } catch (error) {
        print("❌ Transaction error:", error.message);
        if (inTransaction) {
            await session.abortTransaction();
        }
    } finally {
        session.endSession();
    }
}

async function runClient() {
    const endTime = Date.now() + (DURATION * 1000);
    while (Date.now() < endTime) {
        await runSingleTransaction();
    }
}

async function runBenchmark() {
    print("🚀 Checking MongoDB replica set...");
    await checkReplicaSet();

    print("📊 Starting benchmark...");
    const clients = Array(NUM_CLIENTS).fill().map(() => runClient());
    await Promise.all(clients);

    const calculateStats = (arr) => {
        if (arr.length === 0) return { avg: 0, stddev: 0 };
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / arr.length;
        return { avg, stddev: Math.sqrt(variance) };
    };

    const overallStats = calculateStats(latencies);
    const tps = totalTransactions / DURATION;

    print("\n📈 MongoDB Benchmark Results:");
    print(`Transaction Type: TPC-B (Sort of)`);
    print(`Scaling Factor: ${SCALE_FACTOR}`);
    print(`Query Mode: Simple`);
    print(`Number of Clients: ${NUM_CLIENTS}`);
    print(`Number of Threads: ${NUM_THREADS}`);
    print(`Duration: ${DURATION} s`);
    print(`Total Transactions Processed: ${totalTransactions}`);
    print(`Total Queries Executed: ${queryCount}`);
    print(`Total Updates Executed: ${updateCount}`);
    print(`Total Inserts Executed: ${insertCount}`);
    print(`Latency Average = ${overallStats.avg.toFixed(3)} ms`);
    print(`Latency Stddev = ${overallStats.stddev.toFixed(3)} ms`);
    print(`TPS = ${tps.toFixed(6)} (Including Connection Time)`);
}

runBenchmark().catch(error => {
    print("❌ Benchmark failed:", error.message);
    process.exit(1);
});