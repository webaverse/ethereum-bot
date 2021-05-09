FROM node:14
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
EXPOSE 3001
EXPOSE 3002
EXPOSE 1337
COPY . .
CMD [ "node", "index.js" ]
