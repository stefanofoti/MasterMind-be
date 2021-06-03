# Mastermind Readme
This multiplayer game has been developed as project for Mobile Applications and Cloud Computing course. It is mainly composed by two parts (the android application and the node.js backend), interacting with several external services and providers.

## Repo

[Android app](https://github.com/MarcoFerraro94/MasterMind)

[Backend](https://github.com/stefanofoti/MasterMind-be)

## About us
We are two students currently enrolled in the Master's Degree course "Engineering in Computer Science".    

[Marco Ferraro](https://www.linkedin.com/in/?)

[Stefano Foti](https://www.linkedin.com/in/stefano-foti/)

<div align="center"><img src="docs/logo-sapienza.gif" width="400" height="125"/></div>


## The game
The object of Mastermind is to guess a secret code consisting of a series of 4 colored circles. Each player chooses a secret and tries to guess the opponent's one. After each attempt, the system results in feedback a hint containing the number of right colors in right position and the number of right colors in wrong position. The winner is the player who solves his opponent's secret code earlier and within 8 attempts.

## The architecture
<div align="center"><img src="docs/arch.png"/></div>

### The Android app
The android application has been developed with scrum methodology and weekly sprints, plus a month of testing & bugfixing. It is an mvc application offering:
- Authentication: every time a user logs into the application with Google, the application authenticates to the backend providing the Google assigned token, the backend validates the token and provides a fresh JWT token. The authentication is persistent: every user holding a still valid JWT token does not need to authenticate again using google authentication; the token gets periodically refreshed when the application is running, so if you close it and open again after some time you will be automatically in. If you close it and do not open it for a long time, you will need to authenticate from scratch. In both cases user progresses, play statistics and matches history are safely stored on our database.
- Responsive UI: the GUI of the application automatically adapts properly on orientation and size of the screen. 
- Graphics: The application makes extensive use of graphics, while playing and for picking the combination. 
- Concurrency: the application code runs on on multiple thread, in particular for what concerns the REST calls and messaging part.
- Sensors: The application makes use of sensors, detecting the shake of the device. 
- Data consistency: you can always recover the status of the application, i.e. if you're in an active match you can close the application, re-open and keep playing in the same match; if you're in matchmaking mode and the matchmaking finds you an adversary, you can reopen the application and play in that match. Statistics (match counter, win counter, lose counter, current streak, max streak, ...) are updated at the beginning and at the and of each match.
- Messaging: we use rabbit MQ to receive messages asyncronously from the backend.  
- External cloud service: we use a third party service to offer  amazing wallpapers for the application, both portrait and landscape.

The application requires at least android 5.0 (API Level 21).

<div align="center"><img src="docs/mastermind.png" /></div>


### The backend
The node.js backend is a fastify project. Every service available is clearly defined in the 'services' folder. The services for authentication let users authenticate to the backend either with a google account or with a previously provided custom token. In both cases a jwt with a fixed validity is provided. 

### About security
Security aspects have been taken into account from the very beginning of the project. In few lines we let users login using their Google Account; the android app authenticates to the BE sending a request containing the google token; the google token gets validated using google services, the BE signs a JWT token linked to the userId with a long secret and replies with the token. Every request from the smartphone to the BE will contain this JWT token.

<div align="center"><img src="docs/auth.png"/></div>
Authentication sequence diagram

<div align="center"><img src="docs/report-summary.png"/></div>
The connection between FE and BE runs on top of HTTPS, with a valid certificate from released by Microsoft RSA TLS CA 01 (Baltimore CyberTrust Root). The security report by Qualys did not show any pathological pattern. We refuse connection with TLS < 1.2. 

[Complete report here](https://github.com/MarcoFerraro94/MasterMind/blob/main/docs/report.pdf)


## Run

### Android app
In the root folder of the project fill the following:
- CLIENT_ID, given by google; it is required for google sign in
- BE_URI, the url where the BE is running 
- BE_PORT, the port where the BE is listening
- BROKER_URI, the broker connection string, required for async messaging to work properly.

### Backend
#### How to run it locally
The node.js project can be easly installed by typing "npm install", all the dependencies will be automatically resolved. Before starting the project, pick the file config.json; it contains all the endpoints and secrets required by the backend. In particular the DB_URI field is the self-consistent mongodb connection string, containing user, password, db name, endpoint and so on, it should look like: "mongodb+srv://user:pass@endpoint/dbname". The same holds for the AMQP_URI, which is like "amqps://user:pass@endpoint". The TOKEN_SECRET indeed is a simple long hex random secret string: we used a 128 characters hex string. It is used for JWT token generation.

#### Cloud deploy example and DevOps
For the project demo we deployed the backend on Azure, using an App Service with the Plan F1 (SKU F1, the most limited but free plan). It offers 60 minutes of daily CPU usage, 1GB of RAM and few gigabytes of storage. In order to be more efficient and coherent with our methodology, we tuned up a local git on azure s.t. every push on the azure remote correctly processed by the pipeline automatically triggers an oryx build and the deploy of the latest committed version of the BE on a docker container. Remember to copy using FTPS or the Kudu console the config file before the first build, or the build will fail. Our server is running at the domain freely provided by Azure on top of HTTPS. Of course, the HTTPS certificates are valid. Deploy and trace logs are available into the Kudu console.

[Local git Oryx deploy log example](https://github.com/MarcoFerraro94/MasterMind/blob/main/docs/azure_deploy_log_example.txt)


## License
Software is made available under MIT license. See the license file for license rights and limitations.

[License](https://github.com/MarcoFerraro94/MasterMind/blob/main/docs/license.md)
