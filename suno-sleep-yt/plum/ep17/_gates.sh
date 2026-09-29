#!/bin/sh
cd /d/test3/suno-sleep-yt || exit 1
D=plum/ep17; M=$D/music_v95
export CUDA_VISIBLE_DEVICES=""
py -3 plum/_assets/clap_gate.py $M > $D/_clap_v95.txt 2>$D/_clap_err.txt; echo "clap rc=$?"
py -3 plum/_assets/clap_gate_bossa.py $M/07_* $M/08_* > $D/_clap_bossa.txt 2>>$D/_clap_err.txt; echo "bossa rc=$?"
py -3 plum/_assets/hymn_scan.py $M > $D/_hymn_v95.txt 2>&1; echo "hymn rc=$?"
py -3 plum/_assets/vocal_gate.py $M --words 242 --json $D/_vocal_v95.json > $D/_vocal_v95.txt 2>&1; echo "vocal rc=$?"
echo GATES DONE
