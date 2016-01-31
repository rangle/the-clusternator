#!/bin/bash

TEMP_PATH=/tmp
TEMP_FILE=/clusternator-docs.tar.gz

# Fail on error
set -e

# Locate *this* file
echo "Discovering Docker Environment"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# change to this directory
cd $DIR
cd ../docs

# build the docs
npm run doc

# tar the docs
tar cvfz ${TEMP_PATH}${TEMP_FILE}

# switch branches
git checkout gh-pages

# prune
rm -rf ./*

# move in the file
mv ${TEMP_PATH}${TEMP_FILE} ./

# extract
tar xvfz .${TEMP_FILE}

# clean up
rm .${TEMP_FILE}

# commit
git add .
git commit -a

# push
git push origin gh-pages

# return to master
git checkout master

