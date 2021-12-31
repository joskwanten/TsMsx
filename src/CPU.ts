export interface CPU {
    execute(numOfInstructions: number): void;
    halt(): void;
}