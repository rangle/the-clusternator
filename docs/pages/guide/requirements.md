---
layout: page
title: Requirements
permalink: /guide/requirements/
---

There are two components to The Clusternator.  The command line client, and the
server.  

## Client Requirements

- [NodeJs](https://nodejs.org/en/ "Node JS") >= 12
- [GPG](https://www.gnupg.org/ "GNU Privacy Guard")  ~1.4 not included in OS X 
or Windows.  As of 2017 `brew install gpg1` and symlinking to `/usr/local/bin/gpg` is the easiest
- OpenSSH (included on OS X, GNU/Linux)
- [Docker](https://docker.io) (optional)

## Server Requirements

- [NodeJs](https://nodejs.org/en/ "Node JS") >= 4.2.6

The server is designed to be deployed as a Docker container, so in a way, 
Docker is a requirement.
