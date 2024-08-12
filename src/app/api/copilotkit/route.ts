import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  OpenAIAdapter,
} from "@copilotkit/runtime";
import { Action } from "@copilotkit/shared";
import { URL } from 'url';
import { researchWithLangGraph } from "./research";

const UNSPLASH_ACCESS_KEY_ENV = "UNSPLASH_ACCESS_KEY";
const UNSPLASH_ACCESS_KEY = process.env[UNSPLASH_ACCESS_KEY_ENV];

const researchAction: Action<any> = {
  name: "research",
  description:
    "调用此函数对某个主题进行研究。尊重其他关于何时调用此函数的注释",
  parameters: [
    {
      name: "topic",
      type: "string",
      description: "研究的主题。5个字符或更长。",
    },
  ],
  handler: async ({ topic }) => {
    console.log("Researching topic: ", topic);
    return await researchWithLangGraph(topic);
  },
};

// export const POST = async (req: NextRequest) => {
//   // res.setHeader('Access-Control-Allow-Credentials', true)
//   // res.setHeader('Access-Control-Allow-Origin', '*')
//   // another common pattern
//   // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
//   // res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
//   // res.setHeader(
//   //   'Access-Control-Allow-Headers',
//   //   'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version ,X-Copilotkit-Runtime-Client-Gql-Version'
//   // )
//   // if (req.method === 'OPTIONS') {
//   //   res.status(200).end()
//   //   return
//   // }
//   const actions: Action<any>[] = [
//     {
//       name: "getImageUrl",
//       description: "获取主题的图像url",
//       parameters: [
//         {
//           name: "topic",
//           description: "图像的主题",
//         },
//       ],
//       handler: async ({ topic }) => {
//         if (UNSPLASH_ACCESS_KEY) {
//           const response = await fetch(
//             `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
//               topic
//             )}&per_page=10&order_by=relevant&content_filter=high`,
//             {
//               headers: {
//                 Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
//               },
//             }
//           );
//           const data = await response.json();
//           if (data.results && data.results.length > 0) {
//             const randomIndex = Math.floor(Math.random() * data.results.length);
//             return data.results[randomIndex].urls.regular;
//           }
//         }
//         return (
//           'url("https://loremflickr.com/800/600/' +
//           encodeURIComponent(topic) +
//           '")'
//         );
//       },
//     },
//   ];

//   if (
//     process.env["TAVILY_API_KEY"] &&
//     process.env["TAVILY_API_KEY"] !== "NONE"
//   ) {
//     actions.push(researchAction);
//   }

//   const openaiModel = process.env["OPENAI_MODEL"]; 

//   console.log("ENV.COPILOT_CLOUD_API_KEY", process.env.COPILOT_CLOUD_API_KEY);

//   const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
//     runtime: new CopilotRuntime({ actions }),
//     serviceAdapter: new OpenAIAdapter({ model: openaiModel }),
//     endpoint: req.nextUrl.pathname,
//     // baseUrl: 'https://api.openai-proxy.com/v1',
//   });

//   return handleRequest(req);
// };

// import { CopilotRuntime, OpenAIAdapter } from "@copilotkit/backend";
// import OpenAI from "openai";

// const openai = new OpenAI();

export async function POST(req: Request): Promise<Response> {

  const actions: Action<any>[] = [
    {
      name: "getImageUrl",
      description: "获取主题的图像url",
      parameters: [
        {
          name: "topic",
          description: "图像的主题",
        },
      ],
      handler: async ({ topic }) => {
        if (UNSPLASH_ACCESS_KEY) {
          const response = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
              topic
            )}&per_page=10&order_by=relevant&content_filter=high`,
            {
              headers: {
                Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
              },
            }
          );
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.results.length);
            return data.results[randomIndex].urls.regular;
          }
        }
        return (
          'url("https://loremflickr.com/800/600/' +
          encodeURIComponent(topic) +
          '")'
        );
      },
    },
  ];

  if (
    process.env["TAVILY_API_KEY"] &&
    process.env["TAVILY_API_KEY"] !== "NONE"
  ) {
    actions.push(researchAction);
  }
  // const serviceAdapter = new OpenAIAdapter({ openai });
  // const copilotKit = new CopilotRuntime({ actions });
  // return copilotKit.response(req, serviceAdapter);

  const endpoint = new URL(req.url).pathname;

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: new CopilotRuntime({ actions }),
    serviceAdapter: new OpenAIAdapter({ model: process.env["OPENAI_MODEL"] }),
    endpoint,
    // baseUrl: 'https://api.openai-proxy.com/v1',
  });

  return handleRequest(req);
}
