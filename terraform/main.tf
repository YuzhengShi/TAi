terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# --- Availability Zone ---

data "aws_availability_zones" "available" {
  state = "available"
}

# --- VPC (lease account has no default VPC) ---

resource "aws_vpc" "tai" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "tai-vpc"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.tai.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "tai-public-subnet"
  }
}

resource "aws_internet_gateway" "tai" {
  vpc_id = aws_vpc.tai.id

  tags = {
    Name = "tai-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.tai.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.tai.id
  }

  tags = {
    Name = "tai-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# --- Latest Ubuntu 22.04 AMI ---

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# --- SSH Key Pair ---

resource "aws_key_pair" "tai" {
  key_name   = "tai-deploy-key"
  public_key = var.ssh_public_key
}

# --- Security Group ---

resource "aws_security_group" "tai" {
  name        = "tai-ec2-sg"
  description = "TAi EC2 - SSH inbound, all outbound"
  vpc_id      = aws_vpc.tai.id

  # SSH from anywhere — security via key-only auth (password auth disabled on instance)
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound (Bedrock, Canvas, GitHub, WhatsApp, Cloudflare tunnel)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "tai-ec2-sg"
  }
}

# --- IAM Role for Bedrock + S3 ---

resource "aws_iam_role" "tai" {
  name = "tai-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "bedrock" {
  name = "tai-bedrock-access"
  role = aws_iam_role.tai.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:GetFoundationModel",
          "bedrock:ListFoundationModels",
          "bedrock:GetFoundationModelAvailability"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "aws-marketplace:ViewSubscriptions",
          "aws-marketplace:Subscribe",
          "aws-marketplace:Unsubscribe"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "transcribe:StartStreamTranscription",
          "transcribe:StartTranscriptionJob",
          "transcribe:GetTranscriptionJob",
          "transcribe:CreateVocabulary",
          "transcribe:GetVocabulary",
          "transcribe:DeleteVocabulary"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "polly:SynthesizeSpeech"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::tai-backups-prod",
          "arn:aws:s3:::tai-backups-prod/*"
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "tai" {
  name = "tai-ec2-profile"
  role = aws_iam_role.tai.name
}

# --- EC2 Instance ---

resource "aws_instance" "tai" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.tai.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.tai.id]
  iam_instance_profile   = aws_iam_instance_profile.tai.name

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "tai-teaching-assistant"
  }
}

# --- EBS Data Volume ---

resource "aws_ebs_volume" "data" {
  availability_zone = aws_instance.tai.availability_zone
  size              = 20
  type              = "gp3"
  encrypted         = true

  tags = {
    Name = "tai-data"
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.tai.id
}

# --- Elastic IP ---

resource "aws_eip" "tai" {
  domain = "vpc"

  tags = {
    Name = "tai-eip"
  }
}

resource "aws_eip_association" "tai" {
  instance_id   = aws_instance.tai.id
  allocation_id = aws_eip.tai.id
}
