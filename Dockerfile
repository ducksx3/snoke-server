from node:alpine
WORKDIR /usr/bin/snoke-server/
COPY . /usr/bin/snoke-server
CMD node /usr/bin/snoke-server/server.js
EXPOSE 3000

