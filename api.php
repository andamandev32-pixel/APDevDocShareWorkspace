<?php
// API for Document Share (MariaDB)
header("Access-Control-Allow-Origin: *"); // Adjust in production
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Handle Preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ==========================================
// DATABASE CONFIGURATION (Update these!)
// ==========================================
$host = "141.98.17.115";
$db_name = "doc_workspace"; // CHANGE THIS
$username = "root";     // CHANGE THIS
$password = "Andaman888";     // CHANGE THIS
// ==========================================

try {
    $conn = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $exception) {
    http_response_code(500);
    echo json_encode(array("error" => "Connection error: " . $exception->getMessage()));
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// Helper function to map DB row to JS project object
function mapRowToProject($row) {
    return array(
        "id" => $row['id'],
        "title" => $row['title'],
        "desc" => $row['description'],
        "pin" => $row['pin'],
        "type" => $row['project_type'],
        "html" => $row['html_content'],
        "css" => $row['css_content'],
        "js" => $row['js_content'],
        "jsx" => $row['jsx_content'],
        "favorite" => (bool)$row['favorite'],
        "createdAt" => $row['created_at']
    );
}

// Routing logic
switch ($method) {
    case 'GET':
        // Fetch all projects
        try {
            $stmt = $conn->prepare("SELECT * FROM share_projects ORDER BY favorite DESC, created_at DESC");
            $stmt->execute();
            $projects = array();
            while ($row = $stmt->fetch()) {
                $projects[] = mapRowToProject($row);
            }
            echo json_encode($projects);
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(array("error" => "Failed to fetch: " . $e->getMessage()));
        }
        break;

    case 'POST':
        // Add new project
        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->id) || !isset($data->title) || !isset($data->type)) {
            http_response_code(400);
            echo json_encode(array("error" => "Missing required fields."));
            exit();
        }

        try {
            $query = "INSERT INTO share_projects 
                      (id, title, description, pin, project_type, html_content, css_content, js_content, jsx_content, favorite, created_at) 
                      VALUES (:id, :title, :desc, :pin, :type, :html, :css, :js, :jsx, :fav, :created_at)";
            
            $stmt = $conn->prepare($query);
            $stmt->bindParam(":id", $data->id);
            $stmt->bindParam(":title", $data->title);
            $stmt->bindParam(":desc", $data->desc);
            $stmt->bindValue(":pin", empty($data->pin) ? null : $data->pin);
            $stmt->bindParam(":type", $data->type);
            $stmt->bindValue(":html", isset($data->html) ? $data->html : null);
            $stmt->bindValue(":css", isset($data->css) ? $data->css : null);
            $stmt->bindValue(":js", isset($data->js) ? $data->js : null);
            $stmt->bindValue(":jsx", isset($data->jsx) ? $data->jsx : null);
            $fav = isset($data->favorite) && $data->favorite ? 1 : 0;
            $stmt->bindParam(":fav", $fav, PDO::PARAM_INT);
            $stmt->bindParam(":created_at", $data->createdAt);

            if ($stmt->execute()) {
                http_response_code(201);
                echo json_encode(array("message" => "Project created successfully."));
            } else {
                http_response_code(500);
                echo json_encode(array("error" => "Failed to create project."));
            }
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(array("error" => "Database error: " . $e->getMessage()));
        }
        break;

    case 'PUT':
        // Update existing project
        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->id)) {
            http_response_code(400);
            echo json_encode(array("error" => "Project ID is required for update."));
            exit();
        }

        try {
            // We use REPLACE or an explicit UPDATE for all fields
            $query = "UPDATE share_projects SET 
                        title = :title, 
                        description = :desc, 
                        pin = :pin, 
                        project_type = :type, 
                        html_content = :html, 
                        css_content = :css, 
                        js_content = :js, 
                        jsx_content = :jsx, 
                        favorite = :fav
                      WHERE id = :id";
            
            $stmt = $conn->prepare($query);
            $stmt->bindParam(":title", $data->title);
            $stmt->bindParam(":desc", $data->desc);
            $stmt->bindValue(":pin", empty($data->pin) ? null : $data->pin);
            $stmt->bindParam(":type", $data->type);
            $stmt->bindValue(":html", isset($data->html) ? $data->html : null);
            $stmt->bindValue(":css", isset($data->css) ? $data->css : null);
            $stmt->bindValue(":js", isset($data->js) ? $data->js : null);
            $stmt->bindValue(":jsx", isset($data->jsx) ? $data->jsx : null);
            $fav = isset($data->favorite) && $data->favorite ? 1 : 0;
            $stmt->bindParam(":fav", $fav, PDO::PARAM_INT);
            $stmt->bindParam(":id", $data->id);

            if ($stmt->execute()) {
                http_response_code(200);
                echo json_encode(array("message" => "Project updated successfully."));
            } else {
                http_response_code(500);
                echo json_encode(array("error" => "Failed to update project."));
            }
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(array("error" => "Database error: " . $e->getMessage()));
        }
        break;

    case 'DELETE':
        // Delete a project
        if (!isset($_GET['id'])) {
            http_response_code(400);
            echo json_encode(array("error" => "Project ID is required."));
            exit();
        }
        $id = $_GET['id'];

        try {
            $stmt = $conn->prepare("DELETE FROM share_projects WHERE id = :id");
            $stmt->bindParam(":id", $id);
            if ($stmt->execute()) {
                http_response_code(200);
                echo json_encode(array("message" => "Project deleted successfully."));
            } else {
                http_response_code(500);
                echo json_encode(array("error" => "Failed to delete project."));
            }
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(array("error" => "Database error: " . $e->getMessage()));
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(array("error" => "Method not allowed"));
        break;
}
?>
