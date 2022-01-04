export interface CPU {
    execute(numOfInstructions: number, showLog: boolean): number;
    halt(): void;
}