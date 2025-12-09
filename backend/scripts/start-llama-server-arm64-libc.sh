#!/usr/bin/env bash

./../../bin/llama-server -m ../../models/Llama-3.2-1B-Instruct-Q4_K_M.gguf \
  --port 8080 \
  --host 0.0.0.0 \
  --ctx-size 4096 \
  --n-gpu-layers 20 \
  --cont-batching \
  --parallel 4 &

LLAMA_PID=$!

npm start

kill "$LLAMA_PID"
