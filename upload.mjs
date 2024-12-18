import AWS from "aws-sdk";
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const BUCKET_NAME = "administratortest";
const TABLE_NAME = "Administratortest";

function parseFormData(event) {
  const headers = event.headers || {};
  const contentType = headers["Content-Type"] || headers["content-type"];
  if (!contentType || !contentType.includes("multipart/form-data")) {
    throw new Error("Request Content-Type must be multipart/form-data");
  }

  const boundary = contentType.split("boundary=")[1];
  const body = Buffer.from(event.body, "base64").toString("binary"); // Decode Base64 body
  const parts = body.split(`--${boundary}`);
  const parsed = { file: null, metadata: null };

  for (const part of parts) {
    if (part.includes('Content-Disposition: form-data; name="file";')) {
      const start = part.indexOf("\r\n\r\n") + 4;
      const end = part.lastIndexOf("\r\n");
      parsed.file = {
        filename: "uploaded-file",
        content: part.slice(start, end),
      };
    } else if (
      part.includes('Content-Disposition: form-data; name="metadata"')
    ) {
      const start = part.indexOf("\r\n\r\n") + 4;
      const end = part.lastIndexOf("\r\n");
      parsed.metadata = JSON.parse(part.slice(start, end)); // Parse metadata as JSON
    }
  }

  return parsed;
}

export const handler = async (event) => {
  try {
    // Parse the multipart form-data
    const parsed = parseFormData(event);

    if (!parsed.file) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing file in the request." }),
      };
    }
    if (!parsed.metadata) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing metadata in the request." }),
      };
    }

    // Validate metadata
    const metadata = parsed.metadata;
    if (!metadata.author || typeof metadata.author !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "'author' is required in metadata and must be a string.",
        }),
      };
    }

    // Generate a unique file name and upload to S3
    const fileName = `${Date.now()}_${parsed.file.filename}`;
    const fileContentBuffer = Buffer.from(parsed.file.content, "binary");
    const s3Params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: fileContentBuffer,
    };

    await s3.upload(s3Params).promise();

    // Save metadata in DynamoDB
    const dynamoParams = {
      TableName: TABLE_NAME,
      Item: {
        id: fileName,
        UploadedAt: new Date().toISOString(),
        Metadata: {
          author: metadata.author,
          description: metadata.description || "No description provided",
        },
      },
    };

    await dynamodb.put(dynamoParams).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "File successfully uploaded and metadata saved!",
        file_id: fileName,
        metadata,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};
