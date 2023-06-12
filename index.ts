import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from '@pulumi/awsx'

const project_name = 'infra-team'

const tags = { 
  Name: `${project_name}`
}

// Create a repository to store image for web
const repoWeb = new awsx.ecr.Repository(`${project_name}-web`, {
  tags: tags
})

// Create a repository to store image for api
const repoApi = new awsx.ecr.Repository(`${project_name}-api`, {
    tags: tags
})

// Build an image from Dockerfile stored in system and store in repo
const imageWeb = new awsx.ecr.Image(`${project_name}-web`, {
  repositoryUrl: repoWeb.url,
  path: './infra-web',
})

// Build an image from Dockerfile stored in system and store in repo
const imageApi = new awsx.ecr.Image(`${project_name}-api`, {
    repositoryUrl: repoApi.url,
    path: './infra-api'
})

const vpc = new awsx.ec2.Vpc(`${project_name}-vpc`, {
  cidrBlock: "10.0.0.0/16",
  tags: tags,
  instanceTenancy: "default"
});

const sg = new aws.ec2.SecurityGroup(`${project_name}-sg`, {
    vpcId: vpc.vpcId,
    ingress: [{
        fromPort: 80,
        toPort: 80,
        protocol: "tcp",
        cidrBlocks: ["0.0.0.0/0"]
    },
    {
      fromPort: 3000,
      toPort: 3000,
      protocol: "tcp",
      cidrBlocks: ["0.0.0.0/0"]
    }],
    egress: [{
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"]
    }],
    tags: tags
});

// Create an ECS cluster
const cluster = new aws.ecs.Cluster(`${project_name}-cluster`, {
  tags: tags
})

const lb = new awsx.lb.ApplicationLoadBalancer(`${project_name}-lb`, {
  tags: tags,
  securityGroups: [sg.id],
  subnetIds: vpc.publicSubnetIds
})

const td = new awsx.ecs.FargateTaskDefinition(`${project_name}-td`, {
  tags: tags,
  containers: {
    infraweb: {
      image: imageWeb.imageUri,
      memory: 128,
      cpu: 512,
      essential: true,
      environment: [{
        name: 'ApiAddress',
        value: `http://127.0.0.1:5000/WeatherForecast`
      }],
      portMappings: [
        {
          containerPort: 3000,
          hostPort: 3000
        }
      ],
    },
    infraapi: {
      image: imageApi.imageUri,
      memory: 128,
      cpu: 512,
      essential: true,
      portMappings: [
        {
          containerPort: 5000,
          hostPort: 5000
        }
      ],
    }
  }
})

// Lets use a serverless service (Fargate) from Elastic Container Service
const service =  new awsx.ecs.FargateService(`${project_name}-service`, {
  networkConfiguration: {
    assignPublicIp: true,
    subnets: vpc.privateSubnetIds,
    securityGroups: [sg.id]
  },
  cluster: cluster.arn,
  desiredCount: 2,
  taskDefinition: td.taskDefinition.arn,
  tags: tags,
  loadBalancers: [{
    targetGroupArn: lb.defaultTargetGroup.arn,
    containerName: 'infraweb',
    containerPort: 3000
  }]
})

export const ecsTaskUrl = pulumi.interpolate`http://${lb.loadBalancer.dnsName}`