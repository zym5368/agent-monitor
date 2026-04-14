package handlers

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"cluster-agent/docker"
)

var dockerClient *docker.Client

func SetDockerClient(c *docker.Client) {
	dockerClient = c
}

type ContainerItem struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Image   string   `json:"image"`
	Status  string   `json:"status"`
	State   string   `json:"state"`
	Ports   []string `json:"ports"`
	Created int64    `json:"created"`
}

type DockerOverview struct {
	ContainersTotal    int            `json:"containers_total"`
	ContainersRunning  int            `json:"containers_running"`
	ImagesTotal        int            `json:"images_total"`
	PortSummary        []PortStatItem `json:"port_summary"`
}

type PortStatItem struct {
	Port           string   `json:"port"`
	Used           int      `json:"used"`
	ContainerNames []string `json:"container_names,omitempty"`
}

type ImageItem struct {
	ID             string   `json:"id"`
	RepoTags       []string `json:"repo_tags"`
	SizeBytes      int64    `json:"size_bytes"`
	Containers     int64    `json:"containers"`
	ContainerNames []string `json:"container_names,omitempty"`
	CreatedUnix    int64    `json:"created_unix"`
}

func handleContainersList(w http.ResponseWriter, r *http.Request) {
	if dockerClient == nil {
		http.Error(w, `{"error":"docker not available"}`, http.StatusServiceUnavailable)
		return
	}
	list, err := dockerClient.ListContainers(r.Context())
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	items := make([]ContainerItem, len(list))
	for i := range list {
		items[i] = ContainerItem{
			ID:      list[i].ID,
			Name:    list[i].Name,
			Image:   list[i].Image,
			Status:  list[i].Status,
			State:   list[i].State,
			Ports:   list[i].Ports,
			Created: list[i].Created,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]ContainerItem{"containers": items})
}

func handleContainerAction(w http.ResponseWriter, r *http.Request) {
	if dockerClient == nil {
		http.Error(w, `{"error":"docker not available"}`, http.StatusServiceUnavailable)
		return
	}

	// main.go 已对 /api 做 StripPrefix，此处路径形如 /containers/{id}/{action}
	path := strings.TrimPrefix(r.URL.Path, "/containers/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) < 2 {
		http.Error(w, `{"error":"invalid path"}`, http.StatusBadRequest)
		return
	}

	id := parts[0]
	action := parts[1]

	var err error
	switch action {
	case "start":
		err = dockerClient.StartContainer(r.Context(), id)
	case "stop":
		err = dockerClient.StopContainer(r.Context(), id)
	case "restart":
		err = dockerClient.RestartContainer(r.Context(), id)
	case "logs":
		tail := r.URL.Query().Get("tail")
		if tail == "" {
			tail = "100"
		}
		logs, logErr := dockerClient.GetContainerLogs(r.Context(), id, tail)
		if logErr != nil {
			http.Error(w, `{"error":"`+logErr.Error()+`"}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"logs": logs})
		return
	default:
		http.Error(w, `{"error":"invalid action"}`, http.StatusBadRequest)
		return
	}

	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleContainerRemove(w http.ResponseWriter, r *http.Request) {
	if dockerClient == nil {
		http.Error(w, `{"error":"docker not available"}`, http.StatusServiceUnavailable)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/containers/")
	id = strings.TrimSuffix(id, "/")
	if id == "" {
		http.Error(w, `{"error":"invalid path"}`, http.StatusBadRequest)
		return
	}
	force := r.URL.Query().Get("force") == "true"

	err := dockerClient.RemoveContainer(r.Context(), id, force)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleDockerOverview(w http.ResponseWriter, r *http.Request) {
	if dockerClient == nil {
		http.Error(w, `{"error":"docker not available"}`, http.StatusServiceUnavailable)
		return
	}
	containers, err := dockerClient.ListContainers(r.Context())
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	images, err := dockerClient.ListImages(r.Context())
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	running := 0
	portCounter := map[string]int{}
	portContainers := map[string]map[string]struct{}{}
	for _, c := range containers {
		if strings.EqualFold(c.State, "running") {
			running++
		}
		for _, p := range c.Ports {
			portCounter[p]++
			if _, ok := portContainers[p]; !ok {
				portContainers[p] = map[string]struct{}{}
			}
			portContainers[p][c.Name] = struct{}{}
		}
	}
	ports := make([]PortStatItem, 0, len(portCounter))
	for port, used := range portCounter {
		names := make([]string, 0, len(portContainers[port]))
		for n := range portContainers[port] {
			names = append(names, n)
		}
		sort.Strings(names)
		ports = append(ports, PortStatItem{Port: port, Used: used, ContainerNames: names})
	}
	sort.Slice(ports, func(i, j int) bool {
		if ports[i].Used != ports[j].Used {
			return ports[i].Used > ports[j].Used
		}
		return ports[i].Port < ports[j].Port
	})

	resp := DockerOverview{
		ContainersTotal:   len(containers),
		ContainersRunning: running,
		ImagesTotal:       len(images),
		PortSummary:       ports,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleImagesList(w http.ResponseWriter, r *http.Request) {
	if dockerClient == nil {
		http.Error(w, `{"error":"docker not available"}`, http.StatusServiceUnavailable)
		return
	}
	list, err := dockerClient.ListImages(r.Context())
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	containers, err := dockerClient.ListContainers(r.Context())
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	imageToContainers := map[string]map[string]struct{}{}
	imageIDToContainers := map[string]map[string]struct{}{}
	for _, c := range containers {
		if _, ok := imageToContainers[c.Image]; !ok {
			imageToContainers[c.Image] = map[string]struct{}{}
		}
		imageToContainers[c.Image][c.Name] = struct{}{}
		if c.ImageID != "" {
			if _, ok := imageIDToContainers[c.ImageID]; !ok {
				imageIDToContainers[c.ImageID] = map[string]struct{}{}
			}
			imageIDToContainers[c.ImageID][c.Name] = struct{}{}
		}
	}
	items := make([]ImageItem, len(list))
	for i := range list {
		nameSet := map[string]struct{}{}
		for _, tag := range list[i].RepoTags {
			if usedBy, ok := imageToContainers[tag]; ok {
				for n := range usedBy {
					nameSet[n] = struct{}{}
				}
			}
		}
		if usedBy, ok := imageIDToContainers[list[i].ID]; ok {
			for n := range usedBy {
				nameSet[n] = struct{}{}
			}
		}
		names := make([]string, 0, len(nameSet))
		for n := range nameSet {
			names = append(names, n)
		}
		sort.Strings(names)
		items[i] = ImageItem{
			ID:             list[i].ID,
			RepoTags:       list[i].RepoTags,
			SizeBytes:      list[i].SizeBytes,
			Containers:     int64(len(names)),
			ContainerNames: names,
			CreatedUnix:    list[i].CreatedUnix,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]ImageItem{"images": items})
}

func handleImageRemove(w http.ResponseWriter, r *http.Request) {
	if dockerClient == nil {
		http.Error(w, `{"error":"docker not available"}`, http.StatusServiceUnavailable)
		return
	}
	ref := r.URL.Query().Get("ref")
	ref = strings.TrimSpace(ref)
	if ref == "" {
		http.Error(w, `{"error":"invalid image ref"}`, http.StatusBadRequest)
		return
	}
	force := r.URL.Query().Get("force") == "true"
	if err := dockerClient.RemoveImage(r.Context(), ref, force); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
