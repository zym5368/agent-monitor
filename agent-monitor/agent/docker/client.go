package docker

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

type Client struct {
	cli *client.Client
}

func New(ctx context.Context) (*Client, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	return &Client{cli: cli}, nil
}

func (c *Client) Close() error {
	return c.cli.Close()
}

type ContainerInfo struct {
	ID      string
	Name    string
	Image   string
	ImageID string
	Status  string
	State   string
	Ports   []string
	Created int64
}

func (c *Client) ListContainers(ctx context.Context) ([]ContainerInfo, error) {
	list, err := c.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, err
	}
	out := make([]ContainerInfo, 0, len(list))
	for _, cnt := range list {
		name := cnt.Names[0]
		if len(name) > 0 && name[0] == '/' {
			name = name[1:]
		}
		ports := make([]string, 0, len(cnt.Ports))
		for _, p := range cnt.Ports {
			if p.PublicPort > 0 {
				ports = append(ports, fmt.Sprintf("%s:%d", p.Type, p.PublicPort))
			}
		}
		imageID := strings.TrimPrefix(cnt.ImageID, "sha256:")
		if len(imageID) > 12 {
			imageID = imageID[:12]
		}
		out = append(out, ContainerInfo{
			ID:      cnt.ID[:12],
			Name:    name,
			Image:   cnt.Image,
			ImageID: imageID,
			Status:  cnt.Status,
			State:   cnt.State,
			Ports:   ports,
			Created: cnt.Created,
		})
	}
	return out, nil
}

func (c *Client) StartContainer(ctx context.Context, id string) error {
	return c.cli.ContainerStart(ctx, id, container.StartOptions{})
}

func (c *Client) StopContainer(ctx context.Context, id string) error {
	return c.cli.ContainerStop(ctx, id, container.StopOptions{})
}

func (c *Client) RestartContainer(ctx context.Context, id string) error {
	return c.cli.ContainerRestart(ctx, id, container.StopOptions{})
}

func (c *Client) RemoveContainer(ctx context.Context, id string, force bool) error {
	return c.cli.ContainerRemove(ctx, id, container.RemoveOptions{Force: force})
}

func (c *Client) GetContainerLogs(ctx context.Context, id string, tail string) (string, error) {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       tail,
	}
	reader, err := c.cli.ContainerLogs(ctx, id, options)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	data, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (c *Client) InspectContainer(ctx context.Context, id string) (types.ContainerJSON, error) {
	return c.cli.ContainerInspect(ctx, id)
}

type ImageInfo struct {
	ID          string
	RepoTags    []string
	SizeBytes   int64
	Containers  int64
	CreatedUnix int64
}

func (c *Client) ListImages(ctx context.Context) ([]ImageInfo, error) {
	list, err := c.cli.ImageList(ctx, types.ImageListOptions{All: true})
	if err != nil {
		return nil, err
	}
	out := make([]ImageInfo, 0, len(list))
	for _, img := range list {
		id := strings.TrimPrefix(img.ID, "sha256:")
		if len(id) > 12 {
			id = id[:12]
		}
		out = append(out, ImageInfo{
			ID:          id,
			RepoTags:    img.RepoTags,
			SizeBytes:   img.Size,
			Containers:  img.Containers,
			CreatedUnix: img.Created,
		})
	}
	return out, nil
}

func (c *Client) RemoveImage(ctx context.Context, image string, force bool) error {
	_, err := c.cli.ImageRemove(ctx, image, types.ImageRemoveOptions{
		Force: force,
		PruneChildren: true,
	})
	return err
}
