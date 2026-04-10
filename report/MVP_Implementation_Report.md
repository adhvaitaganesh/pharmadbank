## 5. V1 — Baseline Platform
*(Branch: `main`, commit: `e36879a`)*

### 5.1 DataDock as the Starting Point

To accelerate development and build upon proven, open-source foundations, the baseline version for our MVP implementation was derived directly from the DataDock project, a specific published codebase identified in our literature review (Whalen & Valafar, 2024; arXiv:2406.16880). DataDock was originally designed as a secure data hub for researchers and data scientists.

**Analysis Phase and Transition:** Our first crucial step was a comprehensive audit of the repository to transition it from a static research artifact into a functional, running platform. We analyzed the structural architecture to understand precisely how the frontend Single Page Application (built in React) and the backend REST API (built in Django) communicated. By mapping the Redux state management to the Django ORM endpoints, we were able to document the data flow, identify dependencies, and outline the necessary configuration steps required to spin up and stabilize the application environment for our specific use case.

### 5.2 Tech Stack

The underlying technology stack of the V1 baseline aligned exceptionally well with our goals for rapid prototyping and iterative development. The combination of a robust, "batteries-included" backend with a modern, reactive frontend allowed us to quickly establish a working prototype without writing boilerplate architecture.

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Backend | Django + DRF | Rapid development, built-in ORM for complex queries, and secure API handling. |
| Authentication | Knox Token | Provides stateless, per-token revocation, ensuring secure API access. |
| Frontend | React + Redux | Enables a dynamic SPA experience with robust global state management. |
| Database | SQLite | Zero-configuration database, highly portable, and sufficient for prototype testing. |
| Static files | WhiteNoise | Allows Django to serve compiled React assets efficiently without a separate web server. |

### 5.3 Core Feature Overview

Through our initial analysis, we mapped out how the core features interconnect to form the baseline system's functionality. The V1 platform encompasses a robust set of tightly coupled workflows:

*   **User Authentication:** Secure registration and login flows utilizing Knox tokens to authenticate subsequent API requests.
*   **Dataset CRUD & Visibility:** Researchers can Create, Read, Update, and Delete datasets. The system uses a three-tier visibility permission model: fully public, private, or shared selectively with registered organizations.
*   **Organizations:** Basic functionality allowing users to form groups, which securely intersect with the dataset visibility rules.
*   **Review & Rating System:** Users can assess data validity by leaving comments and star ratings on datasets, integrating social feedback directly into the file management UI.
*   **Cart & Batch Download System:** A Redux-managed cart state allows users to queue multiple datasets and initiate asynchronous ZIP downloads.
*   **Notification System:** Automatically alerts authors when their datasets receive reviews or downloads.

#### Key Code Snippet: File Upload & Threading
During our audit, we identified the dataset upload mechanism as a critical, interconnected feature. To prevent UI freezing during large data transfers, the Django backend saves metadata synchronously but processes actual file writing and `.zip` archiving asynchronously in a background thread.

```python
# Asynchronous File Processing (Backend)
def create(self, request):
    # Setup dataset metadata...
    dataSet = DataSet(author=author, is_public=is_public, name=name, original_name=name)
    dataSet.save()

    fileDatas = []
    # Collect files from multipart request...
    for index in range(num_files):
        file_obj = request.data[f"file.{index}"]
        File(dataset=dataSet, file_path=full_path, file_name=str(file_obj)).save()
        fileDatas.append({'file_path': full_path, 'file_data': file_obj.read()})

    # Spawn background thread for I/O operations
    thread = threading.Thread(
        target=process_files,
        args=(fileDatas, strDataSetPath, dataSet.get_zip_path())
    )
    thread.start()
    return Response(self.get_serializer(dataSet).data)
```

### 5.4 Hosting and Server Configuration

With the application audited and running locally, our next major milestone was deployment. We hosted the application on a dedicated Linux server to facilitate remote testing.

However, during this deployment phase, we encountered a significant network configuration problem. By design, the development server and the WhiteNoise static asset pipeline were binding strictly to the local loopback interface (`127.0.0.1` or `localhost`). This security restriction meant the application was entirely inaccessible externally over the internet.

After diagnosing the root cause of the binding issue, we implemented port forwarding using `ngrok`. By creating a secure tunnel, `ngrok` bypassed the strict local binding restrictions and safely exposed the internally running application to the public internet. This solution allowed us to distribute access links for testing without requiring a complex reverse-proxy (e.g., Nginx) or DNS overhaul during the rapid prototyping phase.

### 5.5 Limitations of V1 — Motivating the First Evaluation Round

While the V1 forked baseline provided a massive head start and a functional platform, our analysis identified several gaps that misaligned with a polished production system:

1.  **Insufficient Organization Permission Granularity:** The organization model lacked granular roles (e.g., Admin vs. Member), offering only coarse access control.
2.  **No Data Preview:** Users were forced to download entire `.zip` archives just to inspect the structure or contents of the data, severely hampering usability.
3.  **Coarse File Management:** Inside a dataset, individual file manipulation (e.g., deleting or replacing a single file without re-uploading the entire dataset) was not supported.

These specific gaps made it imperative to gather real-world user feedback to prioritize further development. We needed validation from actual researchers to understand which of these limitations were critical blockers and which were minor inconveniences.

> V1 is running, securely hosted via ngrok—now we need to hear from the users.
