# Stage 1: Build the infra-api
FROM mcr.microsoft.com/dotnet/sdk:5.0-focal AS build

WORKDIR /src

COPY ["infra-api/infra-api.csproj", "infra-api/"]
COPY ["infra-web/infra-web.csproj", "infra-web/"]

RUN dotnet restore "infra-api/infra-api.csproj"
RUN dotnet restore "infra-web/infra-web.csproj"

COPY infra-api ./infra-api
COPY infra-web ./infra-web

RUN dotnet build "infra-api/infra-api.csproj" -c Release -o /app/build/infra-api
RUN dotnet build "infra-web/infra-web.csproj" -c Release -o /app/build/infra-web

# Stage 2: Publish the infra-api
FROM build AS publish
RUN dotnet publish "infra-api/infra-api.csproj" -c Release -o /app/publish/infra-api
RUN dotnet publish "infra-web/infra-web.csproj" -c Release -o /app/publish/infra-web

# Stage 6: Combine infra-api and infra-web images with NGINX
FROM mcr.microsoft.com/dotnet/aspnet:5.0-focal
WORKDIR /app

EXPOSE 3000
EXPOSE 4000

ENV ASPNETCORE_URLS=http://+:4000;http://+:3000

# Creates a non-root user with an explicit UID and adds permission to access the /app folder
# For more info, please refer to https://aka.ms/vscode-docker-dotnet-configure-containers
RUN adduser -u 5678 --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

COPY --from=publish /app/publish/infra-api /app/infra-api
COPY --from=publish /app/publish/infra-web /app/infra-web

CMD ["sh", "-c", "dotnet /app/infra-api/infra-api.dll & dotnet /app/infra-web/infra-web.dll"]