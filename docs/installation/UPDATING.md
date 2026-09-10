# Update Vane-Community to the latest version

To update Vane-Community to the latest version, follow these steps:

## For Docker users (Using pre-built images)

Simply pull the latest image and restart your container:

```bash
docker pull vane-community:latest
docker stop vane-community
docker rm vane-community
docker run -d -p 3000:3000 -p 8080:8080 -v vane-community-data:/home/vane-community/data --name vane-community vane-community:latest
```

For slim version:

```bash
docker pull vane-community:slim-latest
docker stop vane-community
docker rm vane-community
docker run -d -p 3000:3000 -e SEARXNG_API_URL=http://your-searxng-url:8080 -v vane-community-data:/home/vane-community/data --name vane-community vane-community:slim-latest
```

Once updated, go to http://localhost:3000 and verify the latest changes. Your settings are preserved automatically.

## For Docker users (Building from source)

1. Navigate to your Vane-Community directory and pull the latest changes:

   ```bash
   cd vane
   git pull origin master
   ```

2. Rebuild the Docker image:

   ```bash
   docker build -t vane-community .
   ```

3. Stop and remove the old container, then start the new one:

   ```bash
   docker stop vane-community
   docker rm vane-community
   docker run -d -p 3000:3000 -p 8080:8080 -v vane-community-data:/home/vane-community/data --name vane-community vane-community
   ```

4. Once the command completes, go to http://localhost:3000 and verify the latest changes.

## For non-Docker users

1. Navigate to your Vane-Community directory and pull the latest changes:

   ```bash
   cd vane
   git pull origin master
   ```

2. Install any new dependencies:

   ```bash
   yarn install
   ```

3. Rebuild the application:

   ```bash
   yarn build
   ```

4. Restart the application:

   ```bash
   yarn start
   ```

5. Go to http://localhost:3000 and verify the latest changes. Your settings are preserved automatically.

---
