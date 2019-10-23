#!/bin/bash
#open a folder and open terminal inside the folder
#initialize git
git init
#config user
git config --global user.name nammi31
git config --global user.email happynews1997@gmail.com
#see git status
git status
#add file to local git repo
#adding all files
git add .
#to add a single file `git add filename`
#to remove file from git cahce `git rm --cached <file>...`
#to commit `git commit -m "commit name" 
git commit -m "initial commit"
#add git to github repo
git remote add origin https://github.com/Prime38/Thesis.git
#push to git repo
git push -u origin master
