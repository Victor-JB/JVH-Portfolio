#!/bin/bash

# reference https://github.com/pahen/madge?tab=readme-ov-file
# to install:
# npm -g install madge
# brew install graphviz || port install graphviz

madge --image dependency-graph.svg static/src

echo -e "These are the circular imports. logging and session manager are known and \
it's not too bad,\nthe logging could be placed elsewhere (actually I have a file for \
this that is my global logging listeners in listeners.js just realized) but \
admittedly I'll leave that to someone else who wants to refactor"
echo
madge --circular static/src