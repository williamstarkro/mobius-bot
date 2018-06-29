# Mobius Tipping bot

The mobius tip bot is there to thank people for help, be friendly, buy someone a coffee and spread the word about the amazing mobius network.

## Use

You can use the mobius bot on reddit and twitter!

## Setup

Check out the repo and install dependencies:

```
npm install
```

Fire up a postgres container and create two databases:

```
docker run -itd --name db -p 5455:5432 postgres:latest
docker exec -ti db sh -c 'su postgres -c "createdb mobius"'
docker exec -ti db sh -c 'su postgres -c "createdb mobius_testing"'
```

Create an `.env` file:

```
MODE=development

PG_USER=postgres
PG_HOST=localhost
PG_PORT=5455
PG_NAME=mobius
PG_PASSWORD=

STELLAR_HORIZON=https://horizon-testnet.stellar.org
STELLAR_SECRET_KEY=YOUR_SECRET_KEY_HERE

REDDIT_CLIENT_ID=YOUR_REDDIT_APP_CLIENT_ID
REDDIT_CLIENT_SECRET=YOUR_REDDIT_APP_SECRET
REDDIT_USER=YOUR_MOBIUS_BOT
REDDIT_PASS=YOUR_MOBIUS_BOT_PASSWORD
REDDIT_SUBREDDITS=mobius

TWITTER_USER=YOUR_TWITTER_USERNAME
TWITTER_API_KEY=YOUR_TWITTER_API_KEY
TWITTER_SECRET_KEY=YOUR_TWITTER_SECRET_KEY
TWITTER_ACCESS_TOKEN=YOUR_TWITTER_ACCESS_TOKEN
TWITTER_ACCESS_SECRET=YOUR TWITTER_ACCESS_SECRET

```

Create an `.env.test`:

```
MODE=testing

PG_USER=postgres
PG_HOST=localhost
PG_PORT=5455
PG_NAME=mobius_testing
PG_PASSWORD=

REDDIT_SUBREDDITS=foo,bar,baz
```

## Get it going

Run the tests:

```
npm run test
```

Run the app:

```
npm run app
```