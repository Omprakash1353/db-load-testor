const SCALE_FACTOR = parseInt(process.env.SCALE_FACTOR);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE);

// Drop existing collections
db.accounts.drop();
db.tellers.drop();
db.branches.drop();
db.history.drop();

// Create collections with optimized settings
db.createCollection('accounts', { writeConcern: { w: 1 } });
db.createCollection('tellers', { writeConcern: { w: 1 } });
db.createCollection('branches', { writeConcern: { w: 1 } });
db.createCollection('history', { writeConcern: { w: 1 } });

// Create indexes
db.accounts.createIndex({ aid: 1 }, { unique: true });
db.tellers.createIndex({ tid: 1 }, { unique: true });
db.branches.createIndex({ bid: 1 }, { unique: true });
db.history.createIndex({ aid: 1 });

function initializeAccounts() {
    const totalAccounts = 10000 * SCALE_FACTOR;
    for (let i = 0; i < totalAccounts; i += BATCH_SIZE) {
        const batch = [];
        const batchEnd = Math.min(i + BATCH_SIZE, totalAccounts);
        for (let j = i; j < batchEnd; j++) {
            batch.push({
                aid: j + 1,
                abalance: 0
            });
        }
        db.accounts.insertMany(batch, { ordered: false });
        print(`Initialized accounts ${i + 1} to ${batchEnd}`);
    }
}

function initializeTellers() {
    const totalTellers = 10 * SCALE_FACTOR;
    const tellers = Array.from({ length: totalTellers }, (_, i) => ({
        tid: i + 1,
        tbalance: 0
    }));
    db.tellers.insertMany(tellers, { ordered: false });
}

function initializeBranches() {
    const branches = Array.from({ length: SCALE_FACTOR }, (_, i) => ({
        bid: i + 1,
        bbalance: 0
    }));
    db.branches.insertMany(branches, { ordered: false });
}

print("Initializing test data...");
initializeBranches();
print("Branches initialized");
initializeTellers();
print("Tellers initialized");
initializeAccounts();
print("Accounts initialized");