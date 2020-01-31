
# backlog_to_slack

notify backlog's change to slack

GCP version of [this](https://qiita.com/u-minor/items/57e68dd183925b3e6897)

# How to deploy

## manual method

`gcloud beta functions deploy bl2sl --runtime nodejs8 --env-vars-file .env.yaml --trigger-http`

check [https://cloud.google.com/functions/docs/quickstart?hl=ja](https://cloud.google.com/functions/docs/quickstart?hl=ja).

# Environment variables

- SLACK_API_TOKEN
  - set bot backlog's API Token
- SLACK_SIGNING_SECRET
  - set bot backlog's signing secret
- BACKLOG_BASE_URL
  - set BACK LOG PRJ URL ex. `yuorproject.backlog.com`
- BACKLOG_API_KEY
  - set backlog API key which is owned by only administrator
- FUNCTIONS_BASE_URL
  - set google-cloud-functions trigger url (temporary)

# Notification

node v8.0.0
