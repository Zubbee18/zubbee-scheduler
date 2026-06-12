import imgFirecrawlWeb from "./e3bfbfae3fbaad2e70845cfedf4911b9765a65f2.png";
import imgFirecrawlWeb1 from "./11166cfbbf0664dd763fab7f3e890083522ce912.png";
import imgFirecrawlWeb2 from "./b0a840720525f39aa3323a85afd94b3d75ae85af.png";
import imgFirecrawlWeb3 from "./cb9c97248b0055e3eaf8f88a56c42c78101ef7b4.png";

export default function PlaygroundOnFirecrawlWeb() {
  return (
    <div className="content-start flex flex-wrap gap-[80px] items-start relative size-full" data-name="Playground on Firecrawl (Web)">
      <div className="h-[1320px] relative shrink-0 w-[1920px]" data-name="Firecrawl (Web)">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgFirecrawlWeb} />
      </div>
      <div className="h-[1320px] relative shrink-0 w-[1920px]" data-name="Firecrawl (Web)">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgFirecrawlWeb1} />
      </div>
      <div className="h-[1320px] relative shrink-0 w-[1920px]" data-name="Firecrawl (Web)">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgFirecrawlWeb2} />
      </div>
      <div className="h-[1320px] relative shrink-0 w-[1920px]" data-name="Firecrawl (Web)">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgFirecrawlWeb3} />
      </div>
    </div>
  );
}