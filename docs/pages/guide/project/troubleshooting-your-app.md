---
layout: guide-project
title: Troubleshooting Your App
permalink: /guide/project/troubleshooting-your-app
---

Sometimes, you'll deploy your app, navigate to its URL, and it's just not running right.
Fortunately, the Clusternator gives you some tools to help you troubleshoot.

* `clusternator log`
* `clusternator ssh`

Using these commands will require some one-time setup on your part.

## Get set up

Both of these tools require you to set up your machine to connect to your running app
over SSH.  Clusternator makes it easy to wrangle your SSH keys to the right place.

### Add an SSH public key to your app

Run the following command:

```sh
$ clusternator generate-ssh-key -n key-name
```

This will ask you some questions and then generate two files:

* `.private/ssh-public/key-name.pub`
* `~/.ssh/key-name`

The first file is the public ssh key that will eventually end up inside your app's containers.

The second file is the private key that should only reside on your local machine; this is your
ssh authentication credential and _should not be shared with anyone_.

It should however be added to your local machine's `ssh-agent` by running the following command:

```sh
$ ssh-add ~/.ssh/key-name
```

### Deploy the updated keys

You can now deploy the public key to your app.  This is done by pushing the encrypted `.private`
bundle up to github and letting circle-ci deploy it onto your application's machine.

Run the following commands:

```sh
$ clusternator make-private -p $(clusternator project shared-key)
$ clusternator private-checksum
$ git commit -am 'Deploying ssh key'
$ git push
```

Then wait for circle-ci to do its thing.

## Tailing your app's logs

Once the setup above has been completed, you'll be able to see any output from your app
in real time.

Simply run `clusternator log` as follows:

```sh
$ clusternator log
? Choose a Box to Log (Use arrow keys)
❯ Deployment master (52.87.179.218/running)
```

The clusternator will prompt you for the specific instance whose logs you'd like to view.
This is especially handy if you have a number of PRs and other deployments in your CI
pipeline.

## Connecting to your app's instance

Sometimes you need more sophisticated troubleshooting capabilities. Clusternator makes is easy
to locate your apps instances and connect to the with `ssh`:

```sh
$ clusternator ssh                                                                              Fri  8 Apr 2016 12:20:40 EDT
? Choose a Box to Log Deployment master (52.87.179.218/running)
Last login: Thu Apr  7 22:01:10 2016 from 75.98.192.82

   __|  __|  __|
   _|  (   \__ \   Amazon ECS-Optimized Amazon Linux AMI 2015.09.d
 ____|\___|____/

For documentation visit, http://aws.amazon.com/documentation/ecs
[ec2-user@ip-10-0-26-91 ~]$
```

Some handy things you can do once you're in to the instance:

* `docker ps` show active docker containers
* `docker ps` -a show all docker containers including stopped/crashed ones
* `docker logs <hash-from-docker-ps>`/`docker logs --follow <hash-from-docker-ps>`
