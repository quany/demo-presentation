/**
 * 这是 GPT Newspaper 移植到 LangGraph JS 的代码，改编自原始的 Python 代码。
 *
 * https://github.com/assafelovic/gpt-newspaper
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END } from "@langchain/langgraph";
import { RunnableLambda } from "@langchain/core/runnables";
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";

interface AgentState {
  topic: string;
  searchResults?: string;
  article?: string;
  critique?: string;
}

function model() {
  return new ChatOpenAI({
    temperature: 0,
    modelName: process.env["OPENAI_MODEL"],
  });
}

async function search(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  const retriever = new TavilySearchAPIRetriever({
    k: 10,
  });
  let topic = state.agentState.topic;
  // 必须至少有5个字符长
  if (topic.length < 5) {
    topic = "主题: " + topic;
  }
  console.log("搜索主题：", topic);
  const docs = await retriever.getRelevantDocuments(topic);
  console.log("搜索结果长度：", docs.length);
  return {
    agentState: {
      ...state.agentState,
      searchResults: JSON.stringify(docs),
    },
  };
}

async function curate(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  console.log("整理搜索结果");
  const response = await model().invoke(
    [
      new SystemMessage(
        `你是一个私人报纸编辑。 
         你的唯一任务是返回与提供的主题或查询最相关的5篇文章的URL列表，该列表应为JSON字符串
         格式如下：
         {
          urls: ["url1", "url2", "url3", "url4", "url5"]
         }
         .`.replace(/\s+/g, " ")
      ),
      new HumanMessage(
        `今天的日期是 ${new Date().toLocaleDateString("en-GB")}.
       主题或查询: ${state.agentState.topic}
       
       这里有一份文章列表：
       ${state.agentState.searchResults}`.replace(/\s+/g, " ")
      ),
    ],
    {
      response_format: {
        type: "json_object",
      },
    }
  );
  const urls = JSON.parse(response.content as string).urls;
  const searchResults = JSON.parse(state.agentState.searchResults!);
  const newSearchResults = searchResults.filter((result: any) => {
    return urls.includes(result.metadata.source);
  });
  console.log("整理后的搜索结果：", newSearchResults);
  return {
    agentState: {
      ...state.agentState,
      searchResults: JSON.stringify(newSearchResults),
    },
  };
}

async function critique(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  console.log("评论文章");
  let feedbackInstructions = "";
  if (state.agentState.critique) {
    feedbackInstructions =
      `作者已经根据你之前的评论修改了文章: ${state.agentState.critique}
       作者可能在<FEEDBACK>标签之间留下了给你的反馈。
       这些反馈仅供你查看，将会从最终文章中删除。
    `.replace(/\s+/g, " ");
  }
  const response = await model().invoke([
    new SystemMessage(
      `你是一个私人报纸写作评论家。你的唯一任务是对写好的文章提供简短的反馈， 
      这样作者就知道需要修正什么。       
      今天的日期是 ${new Date().toLocaleDateString("en-GB")}
      你的任务是只在必要时对文章提供非常简短的反馈。
      如果你认为文章很好，请返回[DONE]。
      你可以对修改后的文章提供反馈，或者如果你认为文章很好，直接返回[DONE]。
      请返回你的评论字符串或[DONE]。`.replace(/\s+/g, " ")
    ),
    new HumanMessage(
      `${feedbackInstructions}
       这是文章：${state.agentState.article}`
    ),
  ]);
  const content = response.content as string;
  console.log("评论：", content);
  return {
    agentState: {
      ...state.agentState,
      critique: content.includes("[DONE]") ? undefined : content,
    },
  };
}

async function write(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  console.log("写作文章");
  const response = await model().invoke([
    new SystemMessage(
      `你是一个私人报纸作家。你的唯一任务是写一篇关于 
      一个主题的优秀文章，使用文章列表。用markdown格式写5段。`.replace(
        /\s+/g,
        " "
      )
    ),
    new HumanMessage(
      `今天的日期是 ${new Date().toLocaleDateString("en-GB")}.
      你的任务是根据提供的查询或
      主题以及来源写一篇广受好评的文章。
      这里有一份文章列表：${state.agentState.searchResults}
      这是主题：${state.agentState.topic}
      请根据提供的信息返回一篇优秀的文章。`.replace(
        /\s+/g,
        " "
      )
    ),
  ]);
  const content = response.content as string;
  console.log("文章：", content);
  return {
    agentState: {
      ...state.agentState,
      article: content,
    },
  };
}

async function revise(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  console.log("修改文章");
  const response = await model().invoke([
    new SystemMessage(
      `你是一个私人报纸编辑。你的唯一任务是根据给定评论编辑
      一篇关于某个主题的优秀文章。`.replace(/\s+/g, " ")
    ),
    new HumanMessage(
      `你的任务是根据给定的评论编辑文章。
      这是文章：${state.agentState.article}
      这是评论：${state.agentState.critique}
      请根据给定的评论返回修改后的文章。
      你可以在<FEEDBACK>标签之间留下关于评论的反馈，例如：
      <FEEDBACK> 这里是反馈 ...</FEEDBACK>`.replace(/\s+/g, " ")
    ),
  ]);
  const content = response.content as string;
  console.log("修改后的文章：", content);
  return {
    agentState: {
      ...state.agentState,
      article: content,
    },
  };
}

const agentState = {
  agentState: {
    value: (x: AgentState, y: AgentState) => y,
    default: () => ({
      topic: "",
    }),
  },
};

// 定义确定是否继续的函数
const shouldContinue = (state: { agentState: AgentState }) => {
  const result = state.agentState.critique === undefined ? "end" : "continue";
  return result;
};

const workflow = new StateGraph({
  channels: agentState,
});

workflow.addNode("search", new RunnableLambda({ func: search }) as any);
workflow.addNode("curate", new RunnableLambda({ func: curate }) as any);
workflow.addNode("write", new RunnableLambda({ func: write }) as any);
workflow.addNode("critique", new RunnableLambda({ func: critique }) as any);
workflow.addNode("revise", new RunnableLambda({ func: revise }) as any);

workflow.addEdge("search", "curate");
workflow.addEdge("curate", "write");
workflow.addEdge("write", "critique");

// 现在添加一个条件边
workflow.addConditionalEdges(
  // 首先定义起始节点。我们使用 `agent`。
  // 这意味着这些是 `agent` 节点调用后的边。
  "critique",
  // 接下来传入决定下一个节点调用的函数。
  shouldContinue,
  // 最后传入一个映射。
  // 键是字符串，值是其他节点。
  // END 是一个特殊节点，表示图应该结束。
  // 将调用 `should_continue`，然后它的输出将与此映射中的键匹配。
  // 根据匹配的键，调用相应的节点。
  {
    // 如果 `tools`，则调用工具节点。
    continue: "revise",
    // 否则完成。
    end: END,
  }
);

workflow.addEdge("revise", "critique");

workflow.setEntryPoint("search");
const app = workflow.compile();

export async function researchWithLangGraph(topic: string) {
  const inputs = {
    agentState: {
      topic,
    },
  };
  const result = await app.invoke(inputs);
  const regex = /<FEEDBACK>[\s\S]*?<\/FEEDBACK>/g;
  const article = result.agentState.article.replace(regex, "");
  return article;
}
