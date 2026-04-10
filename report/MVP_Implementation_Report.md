## 5. V1 — Baseline Platform
*Branch: `main`, commit: `e36879a`*

### 5.1 DataDock as the Starting Point
To accelerate development and build upon proven, open-source foundations, the baseline version for our MVP implementation was derived from a published research project called DataDock. We will introduce DataDock not just as an app, but as the specific published codebase (arXiv:2406.16880) identified in our literature review. DataDock is an open-source data hub built specifically for researchers and data scientists to securely perform CRUD operations on datasets (Whalen & Valafar, 2024; arXiv:2406.16880).

**Reasons for Selection:** We selected DataDock as our starting point due to its comprehensive feature coverage (handling complex workflows like multipart file uploads, social review aspects, and dataset grouping), its strong tech stack alignment (Django backend with React frontend), and its permissive open-source license.

**Application Analysis and Adaptation:** Before deployment, we conducted a thorough analysis phase. We audited the repository and analyzed how the frontend (React) and backend (Django) connected. This process allowed us to map out the necessary steps to transition it from a static research artifact into a functional, running platform.

### 5.2 Tech Stack

The underlying technology stack of the V1 baseline provided a solid foundation. We utilized this specific stack because it aligned well with our rapid prototyping and development goals, providing essential components like an ORM, a powerful frontend library, and robust authentication right out of the box.

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Backend | Django + DRF | Rapid development, built-in ORM for complex relational queries, and an extensible architecture. |
| Authentication | Knox Token | Provides stateless, per-token revocation, ensuring secure API access from the React frontend. |
| Frontend | React + Redux | Enables a dynamic Single Page Application (SPA) experience with robust global state management. |
| Database | SQLite | Zero-configuration database, highly portable, and sufficient for the initial prototype phase. |
| Static files | WhiteNoise | Allows Django to serve compiled React assets efficiently without requiring a separate web server. |

### 5.3 Core Feature Overview

Based on our initial analysis, the V1 platform encompasses a robust set of features to facilitate research data management. These features interconnect to form the baseline system, handling everything from secure user access to data visibility and sharing.

*   **User Authentication:** Secure registration and login flows utilizing Knox tokens.
*   **Dataset CRUD & Visibility:** Researchers can Create, Read, Update, and Delete datasets. Datasets support a three-tier visibility permission model: fully public, private to the author, or shared selectively with registered organizations.
*   **Organizations:** Basic functionality allowing users to form groups, facilitating private sharing of research data among trusted peers.
*   **Review & Rating System:** Users can assess data validity by leaving comments and star ratings on datasets.
*   **Cart & Download System:** Users can add multiple datasets to a cart and initiate a batch ZIP download.
*   **Notification System:** Alerts authors when their datasets receive reviews, comments, or are downloaded.

#### API Structure
The platform utilizes a RESTful API structure via Django ViewSets. Key endpoints include:
*   `/api/datasets/` & `/api/public_datasets/`: For dataset creation, retrieval, and public browsing.
*   `/api/organizations/`: For managing organizational memberships.
*   `/api/reviews/` & `/api/notifications_review/`: For the social and peer-review features.

#### Key Code Snippet: File Upload & Threading
A critical aspect of the V1 platform is how it handles large dataset uploads. To prevent UI freezing, the Django backend saves metadata synchronously but processes actual file writing and `.zip` archiving asynchronously in a background thread.

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

As part of our steps to ensure proper execution and accessibility, we initially attempted to host the application on a dedicated Linux server. However, we encountered significant networking issues: by design, the application’s development server and static asset serving were strictly bound and not visible externally except from the local server instance (`localhost`).

To bypass these strict internal binding configurations and expose the platform securely to external stakeholders for testing, we diagnosed the local loopback issue and implemented port forwarding using `ngrok`. This allowed us to quickly tunnel traffic to the locally bound server, successfully exposing the application to the internet for testing without needing to overhaul the deployment architecture during the prototyping phase.

### 5.5 Limitations of V1 — Motivating the First Evaluation Round

While the V1 forked baseline provided a massive head start, it had several identifiable gaps that misaligned with a fully polished production system:
1.  **Insufficient Organization Permission Granularity:** The organization model was basic. It lacked granular roles (e.g., Organization Admin vs. Member) for fine-tuned access control.
2.  **No Data Preview:** Users were forced to download entire `.zip` archives just to see the contents or structure of the data, severely hampering usability.
3.  **Coarse File Management:** Inside a dataset, individual file manipulation (deleting or replacing a single file without re-uploading the entire dataset) was not supported.

These specific gaps made it imperative to gather real-world user feedback to prioritize development. Before investing heavily in refactoring, we needed validation from actual researchers to understand which of these limitations were critical blockers and which were minor inconveniences.

> V1 is running, securely hosted via ngrok—now we need to hear from the users.
