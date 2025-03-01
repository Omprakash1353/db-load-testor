@echo off
set NUM_CLIENTS=%1
if "%NUM_CLIENTS%"=="" set NUM_CLIENTS=10
set NUM_THREADS=%2
if "%NUM_THREADS%"=="" set NUM_THREADS=2
set SCALE_FACTOR=%3
if "%SCALE_FACTOR%"=="" set SCALE_FACTOR=10
set DB_CONTAINER=mongo_bench
set BENCH_CONTAINER=mongo_bench_runner
set DB_PORT=27017
set DB_NAME=testdb
set DURATION=60
set BATCH_SIZE=10000
set LOG_FILE=%CD%\mongobench_results.log

echo Cleaning up existing resources...
docker stop %DB_CONTAINER% %BENCH_CONTAINER% >nul 2>&1
docker rm %DB_CONTAINER% %BENCH_CONTAINER% >nul 2>&1
docker network rm loadtest-network >nul 2>&1

echo Creating Docker network...
docker network create loadtest-network >nul 2>&1 || exit /b 1

echo Starting MongoDB container...
docker run --name %DB_CONTAINER% ^
    --network loadtest-network ^
    -p %DB_PORT%:27017 ^
    --memory=4g ^
    --memory-swap=4g ^
    -e "MONGODB_EXTRA_FLAGS=--wiredTigerCacheSizeGB=2" ^
    -d mongo:6.0 mongod --replSet rs0 --bind_ip_all || exit /b 1

echo Initializing replica set...
timeout /t 2 >nul
docker exec %DB_CONTAINER% mongosh --eval "rs.initiate({\"_id\": \"rs0\", \"members\": [{\"_id\": 0, \"host\": \"mongo_bench:27017\"}]})" || exit /b 1

echo Waiting for MongoDB to start...
set /a max_tries=30
set /a counter=0
:check_mongo
docker exec %DB_CONTAINER% mongosh --eval "db.serverStatus()" >nul 2>&1
if %errorlevel% equ 0 goto :mongo_ready
set /a counter+=1
if %counter% gtr %max_tries% (
    echo MongoDB failed to start
    exit /b 1
)
timeout /t 2 >nul
goto :check_mongo
:mongo_ready
echo MongoDB is ready!

echo Initializing test data...
docker run --rm ^
    --network loadtest-network ^
    -e SCALE_FACTOR=%SCALE_FACTOR% ^
    -e BATCH_SIZE=%BATCH_SIZE% ^
    mongo-benchmark-runner ^
    "mongodb://mongo_bench:27017/%DB_NAME%" ^
    --file /init_data.js || exit /b 1

echo Running MongoDB benchmark...
docker run --rm ^
    --network loadtest-network ^
    -e NUM_CLIENTS=%NUM_CLIENTS% ^
    -e NUM_THREADS=%NUM_THREADS% ^
    -e DURATION=%DURATION% ^
    -e SCALE_FACTOR=%SCALE_FACTOR% ^
    mongo-benchmark-runner ^
    "mongodb://mongo_bench:27017/%DB_NAME%" ^
    --file /benchmark.js > "%LOG_FILE%" || exit /b 1

echo Cleaning up...
docker stop %DB_CONTAINER% >nul 2>&1
docker rm %DB_CONTAINER% >nul 2>&1
docker network rm loadtest-network >nul 2>&1

echo Test completed. Results saved in %LOG_FILE%