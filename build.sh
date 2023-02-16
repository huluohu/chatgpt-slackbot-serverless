#!/bin/bash
docker buildx build -t fooololo/chatgpt-slack-bot:latest --platform linux/amd64,linux/arm64 --push .