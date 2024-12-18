import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = "Administratortest";

export const handler = async (event) => {
  const fileId = event.pathParameters?.file_id;

  if (!fileId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Missing file_id in the request URL",
      }),
    };
  }

  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        id: fileId,
      },
    };

    const result = await dynamodb.get(params).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: `File with id ${fileId} not found`,
        }),
      };
    }

    const metadata = result.Item;
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Metadata retrieved successfully",
        metadata: metadata.Metadata,
      }),
    };
  } catch (error) {
    console.error("Error retrieving metadata:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};
