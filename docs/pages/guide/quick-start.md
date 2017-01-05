---
layout: page
title: Quick Start
permalink: /guide/quick-start/
---

## Quick Start

Be sure [to have the requirements installed](/guide/requirements "The Clusternator Requirements")

Quick start assumes your organization already has a running clusternator server,
configured for your organization's cloud.  This also assumes that your
organization has a _private_ GitHub repository for your project.

### Part 1: Install the Clusternator Command-Line Interface (CLI)

```sh
$ npm install -g clusternator
```

### Part 2: Log In to the Clusternator

You should have a Clusternator user name and password for your organization.
If you don't, get your Clusternator administrator to create an account for you.

If you are the Clusternator admin, create accounts like this:

```sh
$ clusternator create-user
? Clusternator username clare
? Authority User
? New Password ******************
? Please Confirm Your Password ******************
```

For `authority` the choices are `Admin`, `User`, and `Project Lead`.  Typically
you'll want to select `User` to create an account with limited privileges.

Give these credentials to the person who wants to use a clusternated project.

Now that person can log in:

```sh
$ clusternator login
? Clusternator username clare
? Password ******************
Login Successful
? Do you want to save this token for future use? Yes
```

Saving the token allows you to use the clusternator without having to re-login
every time from this machine.

If this is a new account given to you by your administrator, it's recommended
that you select a new password for yourself:

```
$ clusternator passwd
? Clusternator username clare
? Password *****************
? New Password ******************
? Please Confirm Your Password ******************
```

Note that you can logout from the clusternator at any time:

```sh
$ clusternator logout
```

### Part 3: You are using a project someone else has already clusternated

Great! you just need to `clusternator login` and get set up.

**Clone the project:**

```sh
$ git clone ssh://git@github.com/my-organization/my-cool-project.git
$ cd my-cool-project
```

**Decrypt the project's deployment configuration:**

Clusternator keeps any credentials, environment variables, and other deployment
secrets for your project in an encrypted tarball that lives with the source code.

In order to run locally you'll need to decrypt it:

```sh
$ clusternator read-private -p $(clusternator project shared-key)
info: Clusternator: Private files/directories un-encrypted
```

This creates local folder called `.private` that contains your application's
deployment secrets.  __Do not share this folder with anyone or commit it to
git in unencrypted form__.

If you foresee a need to adjust anything in `.private`, then you should install
the clusternator git hooks:

```sh
$ clusternator git-hook-install
```

If you change anything in the `.private` folder, the git hooks will re-encrypt
the bundle and add it to your next commit.

If you don't like git hooks and prefer to do this manually, the commands are:

```sh
$ clusternator make-private -p $(clusternator project shared-key)
$ clusternator private-diff
$ git add clusternator.tar.gz.asc
$ git add .clusternator/.private-checksum
$ git commit
```

You should now be able to run the project using

```sh
$ clusternator serve
```

### Part 4: You are clusternating a new project

Make sure the repo exists locally and in github.  `cd` to your local clone.

Do a `clusternator login`.  Your admin will have needed to give you at least
`Project Lead` privileges for this to work.

Initialize the project and follow the prompts.

```sh
$ clusternator init
```

Follow the prompts
If everything goes well there will be a `CLUSTERNATOR_SHARED_KEY`, and a
`GITHUB_KEY`  provided at the end of the init.

Turn on CircleCI for your project repo. In circle-CI's project settings,
_One_ (1) environment variable needs to be added: `CLUSTERNATOR_SHARED_KEY`
set it to the value you get from the `clusternator project shared-key` command.

This gives circle CI the ability to build your project's docker file from the
code and the encrypted secrets bundle.

Navigate to the `github.com/my-organization/my-cool-project.git` repository's
web interface

- Click `settings`
- On the left nav bar click `webhooks & services`
  - In the payload URL field enter: https://the-clusternator.my-organization.com/0.1/github
  - Leave the content type as JSON
  - enter the output of `clusternator project git-hub-key` in the `secret` field.
  - Set "Which events would you like to trigger this webhook?" to "Everything"
  - Click Add

That's it.

The project will produce new deployments each time a pull request is
issued.  The project will tear down those deployments when PRs close.

When anything is merged to `master`, the master instance deployment will be
updated with the latest code.
