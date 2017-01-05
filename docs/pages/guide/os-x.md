---
layout: page
title: Running Clusternator On OS X
permalink: /guide/os-x/
---

## OS X Requirements

- nodejs
- gpg (1.4)
- docker (optional)

## nodejs

There are a number of ways to install node on OS X.  Brew users can simply

```
brew install nodejs
```

Node can also be installed manually by using the [installer][nodejs]

Node's source can also be [downloaded][nodejs] and built.  Building node is
beyond the scope of this document.

##  gpg - GNU Privacy Guard

There are a number of ways to install gpg on OS X.  Brew users can  (as of 2017)

```
brew install gpg1
```

```
sudo ln -s /usr/local/bin/gpg1 /usr/local/bin/gpg
```

The `ln -s` above used to not be an issue but as of 2017 brew ships with gpg2 as the default and it has an entirely different symmetric encryption model.

GPG can also be manually installed by [visiting macgpg][gpg]

GPG's source can also be [downloaded][gpg] and built.  Building gpg is beyond
the scope of this document.

## Docker (Optional)

Dev's using clusternator only need to install Docker if they plan on working
with Docker containers on their local system.  In many cases this may not be
necessary.

Best practice is to install [the latest][docker] version of docker, as opposed
to using a package manager like Brew.  The installer is just as straightforward
as any other mainstream installer.

Docker for OS X will also install _Virtual Box_, because Docker only works with
the Linux kernel.

Once Docker is downloaded, and installed, run it, and it will create its initial
environment/virtual machine.

### Finding Your Docker VM's IP

Docker containers run in a GNU/Linux virtual machine.  Docker services are
served _from_ this machine, _not_ the developer's localhost.  This means that in
order to actually use a local Docker service the developer will need to
determine the IP address of their virtual machine.

To find the IP, run from the CLI/Bash:

```
docker-machine ls
```

This will list all the Docker virtual machines (not to be confused with
containers) running on the local system.  Output might look something like:

```
NAME      ACTIVE   DRIVER       STATE     URL                         SWARM
default   *        virtualbox   Running   tcp://192.168.99.100:2376
```

Given the above output, Docker instances will be found at `192.168.99.100`, and
the port/protocol will depend on the services that particular container is
running, and how its ports have been mapped.


### Starting Docker After Reboot

Docker for OS X depends on some environment variables being set, this process is
mostly automatic.

To get Docker working after reboot:

- Run "Docker Quick Start Terminal" OS X app
- In a CLI/Bash run 

```
docker-machine env defaul && \
eval "$(docker-machine env default)"
```

#### When/If Things Go Wrong (like a network change)

Sometimes things do not go as planned.  Sometimes, like when a network changes,
or when a laptop sleeps, OS X's docker environment has issues.  These often
manifest as "network errors".

Fortunately Max OS X's Docker environment is virtual, and can be _completely_ 
reset:

```
killall -9 VBoxHeadless && docker-machine restart default 
```
followed by

```
docker-machine env default && eval "$(docker-machine env default)" 
```

It's possible these can be combined into a one liner, but that does not
translate nicely into markdown.


#### Stopping Docker

Sometimes the reader will want to completely stop Docker, and free up resources

- Open _Virtual Box_ application
- Stop/Power off the default VM.  This should be the only VM unless the reader
uses _Virtual Box_ for their own purposes


[nodejs]:https://nodejs.org/en/download/ "Node JS Downloads"
[gpg]: http://macgpg.sourceforge.net/ "Mac GPG"
[docker]: https://www.docker.com/docker-toolbox "Docker Toolbox download"
