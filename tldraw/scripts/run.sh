#!/bin/bash
# 5 rounds; in each round both modes run cold then warm; the starting mode alternates.
# usage: TLDRAW_DIR=<tldraw checkout> scripts/run.sh <outDir>
S=$(cd "$(dirname "$0")" && pwd); R=${1:?outDir}; mkdir -p "$R"
for round in 1 2 3 4 5; do
  if [ $((round % 2)) -eq 1 ]; then order="plain bundled"; else order="bundled plain"; fi
  for m in $order; do
    for t in cold warm; do
      lsof -ti :5440 | xargs kill 2>/dev/null; sleep 2
      node "$S/bench.mjs" $m $t "$R/$m-$t-$round.json"
    done
  done
done
