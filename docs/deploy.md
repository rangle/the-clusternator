# DEPLOY

## How does the clusternator deploy applications?

To understand the deploy process, we must first understand the ECS deploy process.
The rough steps are as follows:


- You send an update to the app definition to an ECS cluster
- ECS cluster reads app definiton and saves it in memory
- ECS looks for available EC2 box (running task with same name, or not running anything)
- ECS cluster halts execution of running containers
- ECS reads images from appdef files, pulls images
- ECS calls `docker run` on all your images with the specified port mappings, links, and volumes


To simply things. All you do is update the image name / version / tag / etc. in your
appdef.json, fire it at the ECS cluster (with clusternator) and wait for your
docker containers to start up again.


## Create an ECS cluster

First things first, you need an ECS cluster to deploy your application on.
The following command will provision an ECS cluster with an EC2 box responsible
for running your application.


**Be sure to have the IDs for your subnet and security group ready.**


```
clusternator cluster:new\
-c PICK_A_CLUSTER_NAME\
-a appdef.json\
-k clusternator-test-keypair\
-n subnet-0f0f0f0f\
-g sg-0f0f0f0f
```

It takes a minute or two to provision the EC2 box. You can check on the
progress from the EC2 home page in the AWS console. **You will also find
the hostname / IP of the box here**, you can use this to test.


## Update your application

Updating your application is simple, all you have to do is edit your
`appdef.json` and send the update to your cluster.

```
clusternator cluster:update\
-c CLUSTER_NAME_YOU_PICKED\
-a appdef.json
```


## CAVEATS

### Docker image versioning and `:latest`

##### Problem

ECS will be responsible for attempting to restart containers marked as
`essential` (see appdef documentation for more details). If you 
**ONLY SPECIFY AN IMAGE NAME WITHOUT A VERSION** docker will pull
the image with the tag `:latest` (which is automatically assigned by docker
hub).

##### Solution

Use tags and versions explicitly. I suggest using the `package.json` file
as the master version number. You can use this command on your CI server
to tag docker images appropriately.

```
docker build -t USER/REPO:$(cat package.json | grep version | head -1 | sed -e 's/version//g' -e 's/://g' -e 's/"//g' -e 's/,//g' -e 's/ //g') .
```
