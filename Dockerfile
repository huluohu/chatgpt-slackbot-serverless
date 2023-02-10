FROM node:18
WORKDIR /app
ADD package.json package-lock.json /app/
RUN apt-get update && apt-get install -y apt-utils
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get update
RUN npm i
RUN npm install -g npm@9.2.0
RUN npm install -g pm2
ADD . /app
EXPOSE 4005 3002
## pm2 start npm -- run dev
CMD ["pm2-runtime", "start","--name","chatgpt","npm","--","run","start"]