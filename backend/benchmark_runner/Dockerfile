FROM mongo:6.0

RUN apt-get update && apt-get install -y bash
COPY init_data.js /init_data.js
COPY benchmark.js /benchmark.js

CMD ["mongosh"]