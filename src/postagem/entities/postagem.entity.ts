import { Transform, TransformFnParams } from "class-transformer";
import { IsNotEmpty } from "class-validator";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Tema } from "../../tema/entities/tema.entity";
import { Usuario } from "../../usuario/entities/usuario.entity";
import { ApiProperty } from "@nestjs/swagger";

@Entity({name: "tb_postagens"}) // Criando a Tabela
export class Postagem{

    @PrimaryGeneratedColumn() // Chave Primária Autoincremental
    @ApiProperty() 
    id: number;

    @Transform(({ value }: TransformFnParams) => value?.trim()) // Bloquear apenas espaços em branco
    @IsNotEmpty() // Não aceitar titulo vazio
    @Column({length: 100, nullable: false}) // Definir o tamanho e não aceitar valor nulo
    @ApiProperty() 
    titulo: string;
 
    @Transform(({ value }: TransformFnParams) => value?.trim())
    @IsNotEmpty()
    @Column({length: 1000, nullable: false})
    @ApiProperty() 
    texto: string;

    @UpdateDateColumn() // A data e a hora serão preenchidas automaticamente
    @ApiProperty() 
    data: Date;

    // Muitos para Um, ou seja, Muitas postagens, possuem um tema
    @ManyToOne(() => Tema, (tema) => tema.postagem, {
        onDelete: "CASCADE"
    })
    @ApiProperty({ type: () => Tema }) 
    tema: Tema;

    @ManyToOne(() => Usuario, (usuario) => usuario.postagem, {
        onDelete: "CASCADE"
    })
    @ApiProperty({ type: () => Usuario }) 
    usuario: Usuario;
}