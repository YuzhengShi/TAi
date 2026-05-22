output "public_ip" {
  description = "Elastic IP address"
  value       = aws_eip.tai.public_ip
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.tai.id
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/tai-deploy ubuntu@${aws_eip.tai.public_ip}"
}

output "ami_id" {
  description = "Ubuntu AMI used"
  value       = data.aws_ami.ubuntu.id
}

output "data_volume_id" {
  description = "EBS data volume ID"
  value       = aws_ebs_volume.data.id
}
