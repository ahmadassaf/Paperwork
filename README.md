Paperwork
=========
[<img src="https://img.shields.io/matrix/paperwork:matrix.org.svg?color=%2361BCEE&label=JOIN%20THE%20CHAT&server_fqdn=matrix.org&style=for-the-badge"/>](https://riot.im/app/#/room/#paperwork:matrix.org)

Paperwork is an open-source, self-hosted alternative to services like Evernote®, Microsoft OneNote® or Google Keep® ([check video](https://player.vimeo.com/video/401737579))


## Mission

We at Paperwork believe that your private data should be yours and no other person or corporation should be able to access or even benefit from it. Hence it is our goal to build software that enables everyone to store and manage their documents in a cloud that's theirs alone – whether it's a computer scientist working with confidential data, a critical journalist, a freedom-of-speech activist or just your grandparents. Our goal is to be your privacy focused, open-source alternative to Evernote®, Microsoft OneNote® and Google Keep® for capturing ideas and managing documents.


## Current State

Paperwork currently is *under development*. In order to get Paperwork in its current state running, you have to have an understanding for how Docker and DNS works and know the basic concepts of HTTP proxying. Also, experience with Traefik and Minio might come in handy. 

If you don't have that, then the current state of Paperwork probably isn't for you. To make it clear: **This software is not *usable* at this moment. It's being worked on to be *made usable* in the near future. In its current state, Paperwork v2 is targeted to developers that would like to get their hands dirty and contribute to the project.**


## Live Demo

A live demo of the current Paperwork status is available at:

[**https://www.demo.paperwork.cloud**](https://www.demo.paperwork.cloud) 

This instance won't persist data on the server side, but it does store it inside your browser session. The instance is being destroyed every night at 3am UTC. Therefor all accounts are only valid for maximum one day. **Please do not use this instance to store actual data/sensitive information!**

If you try the live demo on a regular basis please **make sure to clear your local browser cache**.

This demo instance is sponsored by [twostairs](https://twostairs.co).


## Quickstart

This repository is structuring and unifying all required components for Paperwork. It its purpose is to provide an **example of how you *could* host Paperwork yourself**.

```bash
$ git clone git@github.com:paperwork/paperwork.git
```


### Docker Stack

In order to easily get Paperwork running as a Docker stack, utilising whichever orchestrator you'd like, this repository comes with a handy Makefile. Let's have a look at it:

```bash
$ make help
```


#### Configuration

Before deploying the Docker stack, you need to configure the environment properly. You can use the existing `.env.example` files as a template for that:

```bash
$ cd env/
$ ls -1 | while read ef; do echo $ef | sed 's/\.example$//g' | xargs -I{} cp {}.example {}; done
```

With these files, the Docker stack is configured to use [www.paperwork.local](http://www.paperwork.local) (for the [web UI](https://github.com/paperwork/web)) and [api.paperwork.local](http://api.paperwork.local) (for the API services) by default. Hence you will need to add these to the `127.0.0.1` entry in your `/etc/hosts` file:

```
127.0.0.1   localhost paperwork.local api.paperwork.local www.paperwork.local
```

If you'd want to use a different domain and different hostnames for web and API, make sure to change the values inside [env/env.env](env/env.env) and [env/web.env](env/web.env). For using this stack in a live deployment, **you might also want to change passwords, JWT secrets and Erlang cookies** across the `.env` files.


#### Deployment

Launching the Paperwork can be done by make`-ing the `deploy` target:

```bash
$ make deploy
```

The Makefile then takes care of initialising Swarm, in case you haven't done that already, creating the encrypted network (`papernet` or, if you use it from outside the stack, `paperwork_papernet`) and deploying the Paperwork stack on top of it.


In order to stop/remove the whole stack, simply use the `undeploy` target:

```bash
$ make undeploy
```

**Note:** This won't make your Docker host leave Swarm again, in case it wasn't running in Swarm mode before deploying! If you'd like to turn off Swarm, you have to do so manually.


#### Orchestrator

If you'd like to use a different orchestrator for stack deployment, you can do so by setting the `ORCHESTRATOR` variable on deploy:

```bash
$ make deploy ORCHESTRATOR=kubernetes
```

For more info, check the official Docker documentation [for Mac](https://docs.docker.com/docker-for-mac/kubernetes/#override-the-default-orchestrator) and [Windows](https://docs.docker.com/docker-for-windows/kubernetes/#override-the-default-orchestrator).


### Usage

As soon as you've finished the setup, you should be able to access [your Paperwork deployment through this URL](http://www.paperwork.local) and you should be greeted with the login/registration:

![Welcome to Paperwork](https://github.com/paperwork/web/raw/master/docs/current-state-01.png)

In order to use Paperwork, you will need to register a new account.


## Development

In case you want to actively start developing on Paperwork, feel free to check out this branch and get involved with what's there already to get an idea of where Paperwork is heading. Also head to the [current issues](https://github.com/paperwork/paperwork/issues) to see what needs to be done and suggest what could be done.

As for now, all tasks/issues are being [collected inside this repository](https://github.com/paperwork/paperwork/issues), just to keep it simple. On a long term, tasks/issues will be transferred into the related service's repository, in order to be able to reference them through git commits.

Make sure to join the [official chatroom](https://riot.im/app/#/room/#paperwork:matrix.org) as well.


### Software Architecture Overview

![Paperwork Architecture](Paperwork%20Architecture.png)


The Paperwork project consists of a handful of custom-built API services, which take care of everything related to their specific domain: Configurations, users, notes & attachments. Underneath those, there are various infrastructure services which are either implemented by the Paperwork project (`service-gatekeeper`) or simply awesome third-party open-source projects that's being made use of (e.g. [Minio](https://github.com/minio/minio) and [Traefik](https://github.com/containous/traefik)).

The API services provide the core logic that processes domain specific data and persists it on the service's own database. Each API service has its own database that no other services accesses directly. Instead, services communicate with each other through internal HTTP endpoints. The gatekeeper service abstracts the authorisation layer from each individual service by checking and decoding the JWT bearer, so that every service that runs behind `service-gatekeeper` can be sure that access was validated and session information is forwarded and accessible via HTTP headers. JWT crafting is currently done in `service-users`. Hence, `service-gatekeeper` and `service-users` need to share the same JWT secret. Implementation in this area is kept simple for now but will change with the introduction of OAuth 2.

While the API services are not exchangeable, infrastructure services usually are. For example Traefik could be replaced with NGINX, Minio with a real Amazon S3 storage and even gatekeeper could more or less easily be replaced with Kong or a similar API gateway in future. API services on the other hand are tightly integrated with the business logic and their own databases. Also, because they exchange information with each other through internal endpoints, they depend on each other and (partially) on their peer's data structures. For example the notes service performs an internal request towards the users service when a note is being requested, in order to include user information (first name, last name, etc) for every `access` definition within that note. This aggregation of data is not necessary form a back-end point of view and is only done in order to make things more comfortable for the UI layer. While, from a separation-of-concerns-perspective this might not be an ideal setup, it reduces complexity for now and allows the project to iterate quite quickly.

On top of the infrastructure and API services there is the UI layer that was just mentioned, which currently consists of the *Paperwork Web UI*. The web UI is a PWA built on Angular that talks to the API services through the gatekeeper service. It's aimed to provide 100% offline use capabilities, so that it can be worked with in scenarios in which there's no connectivity to the API.

**Info: 99% of development happens [inside the individual service repositories](https://github.com/paperwork)! This repository only contains the one-click-deployment and the local development environment helper!**


### Repositories

Here are the main repositories of Paperwork:

- [`paperwork`](https://github.com/paperwork/paperwork): This is the repository you're currently looking at, containing the one-click-deployment and high-level documentation.
- [`paperwork.ex`](https://github.com/paperwork/paperwork.ex): This is the Elixir SDK for building Paperwork services. Every Elixir-based service includes this as a dependency.
- <img src="https://img.shields.io/docker/cloud/build/paperwork/service-gatekeeper.svg?style=flat-square"/> [`service-gatekeeper`](https://github.com/paperwork/service-gatekeeper): This is the *gatekeeper* service that reverse-proxies requests to individual services and takes care of JWT validation/decoding. This service was written in Rust.
- <img src="https://img.shields.io/docker/cloud/build/paperwork/service-configs.svg?style=flat-square"/> [`service-configs`](https://github.com/paperwork/service-configs): This is the configurations service built in Elixir. It stores configurations and provides internal endpoints for other services to access them.
- <img src="https://img.shields.io/docker/cloud/build/paperwork/service-users.svg?style=flat-square"/> [`service-users`](https://github.com/paperwork/service-users): This is the users service built in Elixir. It stores accounts and profile information and provides internal endpoints for other services as well as external endpoints for user registration, login and profile management.
- <img src="https://img.shields.io/docker/cloud/build/paperwork/service-notes.svg?style=flat-square"/> [`service-notes`](https://github.com/paperwork/service-notes): This is the notes service built in Elixir. It stores all users' notes and provides external CRUD endpoints.
- <img src="https://img.shields.io/docker/cloud/build/paperwork/service-storages.svg?style=flat-square"/> [`service-storages`](https://github.com/paperwork/service-storages): This is the storages service built in Elixir. It stores all users' attachments and provides external CRUD endpoints.
- <img src="https://img.shields.io/docker/cloud/build/paperwork/service-journals.svg?style=flat-square"/> [`service-journals`](https://github.com/paperwork/service-storages): This is the journals service built in Elixir. It stores events that are related to database changes and provides external CRUD endpoints.
- <img src="https://img.shields.io/docker/cloud/build/paperwork/web.svg?style=flat-square"/> [`web`](https://github.com/paperwork/web): This is the Angular-based web front-end for Paperwork.


### Local development environment

This repository not only features a one-click Docker Stack deployment, but also a local development environment which should work on any Linux/Unix platform.


#### Using the local development environment

In order to launch the local development environment, simply use the same `make` command you use for running local development instances of Paperwork service: `make local-run-develop`

```bash
$ cd paperwork/
$ make local-run-develop
```

The local development environment will start up with a short info on what's needed in order for it to function correctly. Please **read the instructions provided there** and follow them carefully. You will need to have some dependencies (e.g. Docker, Caddy) installed in order for the local development environment to function.

Also make sure to have the following TCP ports free on your system while using the local development environment:

-  `1337`: [`service-gatekeeper`](https://github.com/paperwork/service-gatekeeper)
-  `4200`: [`web`](https://github.com/paperwork/web)
-  `5672`: [RabbitMQ](https://www.rabbitmq.com) (a.k.a. `service-events`)
-  `8000`: [Caddy](https://github.com/mholt/caddy) (proxy used for local development)
-  `9000`: [Minio](https://github.com/minio/minio) (used as `service-storages` back-end)
- `15672`: [RabbitMQ management interface](http://localhost:15672/) (default login username `guest`, password `guest`)
- `27017`: [MongoDB](https://github.com/mongodb/mongo) (a.k.a. `service-collections`)

Optionally, if you plan to run any of the following services, you'll need to make sure to have their local development environment ports free as well:

- `8080`: [`service-configs`](https://github.com/paperwork/service-configs)
- `8081`: [`service-users`](https://github.com/paperwork/service-users)
- `8082`: [`service-notes`](https://github.com/paperwork/service-notes)
- `8083`: [`service-storages`](https://github.com/paperwork/service-storages)
- `8084`: [`service-journals`](https://github.com/paperwork/service-journals)

Check [this video (38MB)](https://d.pr/v/AN2r8D) in order to see how easy it is to get your local development up and running with `make local-run-develop`.

Here's the flow for launching everything that's required for development:

Terminal 1:
```bash
$ cd paperwork/
$ make local-run-develop
```
*(follow the instructions given)*

Terminal 2:
```bash
$ cd service-gatekeeper/
$ make local-run-develop
```

Terminal 3 and following:
```bash
$ cd service-.../
$ make local-run-develop
```

You should be good to go at this point. The Elixir services use code hot-reloading so you shouldn't need to kill the running process and re-launch it through `make local-run-develop` for every change you make. However, there are changes that won't get activated through hot-reloading. In that case, simply *Ctrl+C* and `make local-run-develop` again for that specific service.


#### Using the local database

The local development environment brings its own database. It's a vanilla MongoDB container that's being launched on its official port `27017`. You can use the [`mongo` shell](https://docs.mongodb.com/manual/mongo/) or a GUI like [Robo 3T](https://robomongo.org/download) to connect to it by via [`localhost:27017`](mongodb://localhost:27017).

Every service uses this database to store its data. Each service uses its own collection inside this database. Services will never access other services' collections directly. If service A needs to have some of service B's data changed, it requests service B to do so through internal endpoints. This type of communication is cached and abstracted using [`paperwork.ex`](https://github.com/paperwork/paperwork.ex).


## Supporting Paperwork

The best way to help this project is by contributing to the code. However, if that should not be possible to you, but you'd still like to help, the Paperwork project gladly accepts support in form of Bitcoins and Ether. Please use the following addresses to direct your donations:

- Ethereum: `0x8Ea80Ab7eD3e925BdF1975F5afEb6bcA23C6581a`
	![0x8Ea80Ab7eD3e925BdF1975F5afEb6bcA23C6581a](donate-ether.png)
- Bitcoin: `3DzwbsXp53VhANzF3jF2ch28Qnv1BeX1jk`
	![3DzwbsXp53VhANzF3jF2ch28Qnv1BeX1jk](donate-bitcoin.png)

**CAUTION: Do not send any donations to anywhere else but those addresses. Unfortunately we had situations in which random people (that were not affiliated with this project in any kind) posted PayPal addresses inside GitHub issues in order to scam money.**


## Links

- [Browse](https://paperwork.cloud)
- [Chat](https://riot.im/app/#/room/#paperwork:matrix.org)
- [Tweet](https://twitter.com/paperworkcloud)
- [Mail](mailto:highfive@paperwork.cloud)


## Footnote

This branch contains the second iteration of Paperwork, which is a complete rewrite. Not only is it based on another framework - it is based on a completely different technology stack. **It is in its very early development phase and not yet usable**.

*If you were looking for the Laravel-based version 1 of Paperwork, please check [out this branch](https://github.com/paperwork/paperwork/tree/1). **Version 1 is not in active development anymore!***


<script>
(function(f, a, t, h, o, m){
a[h]=a[h]||function(){
(a[h].q=a[h].q||[]).push(arguments)
};
o=f.createElement('script'),
m=f.getElementsByTagName('script')[0];
o.async=1; o.src=t; o.id='fathom-script';
m.parentNode.insertBefore(o,m)
})(document, window, 'https://cdn.usefathom.com/tracker.js', 'fathom');
fathom('set', 'siteId', 'EOJSAIDR');
fathom('trackPageview');
</script>
