# Sociocon

A Node.js, Socket.io and Microservices based application that allows friends to enter one-on-one chats with persistent messaging. 

Users can become friends to each other by sending Friend Requests and accepting them.

Implements 'Discovery' microservice to allow front end to contact other microservices through it.

Also implements separate 'Authentication' microservice to allow user to Log in (generate a JWT) or Log out (remove respective JWT) from the system.

Uses RabbitMQ message broker for transmission of events to the microservices used by this project.

Each microservice can be independently deployed into its own Docker container using Jenkins.
